/**
 * Azure AI Document Intelligence adapter (IR-001, IR-003, IR-004, FR-027).
 *
 * Uses the REST API directly rather than the SDK. Three reasons:
 *  - the analyze operation is a two-step submit/poll, and doing it explicitly
 *    makes the timeout and retry behaviour visible rather than buried in
 *    client options;
 *  - one fewer dependency in a project whose point is to be readable;
 *  - the request shape is then documented by the code itself, which is what
 *    `power-automate/workflow.md` maps onto the HTTP connector action.
 *
 * Credentials are read from server-side configuration and never leave this
 * module.
 */

import { azureAnalyzeResultSchema } from '../domain/schemas'
import { normalizeAzureResult } from './normalize'
import type {
  ExtractionAdapter,
  ExtractionInput,
  ExtractionResult,
} from './types'
import type { AppConfig } from '../config'

interface AzureAdapterOptions {
  /** Injected in tests so retry and timeout behaviour can be exercised. */
  fetchImpl?: typeof fetch
  /** Poll interval while the analyze operation is running. */
  pollIntervalMs?: number
  /** Attempts on a retryable failure, including the first. */
  maxAttempts?: number
}

/** 5xx and 429 are transient. 4xx (other than 429) will not improve on retry. */
const isRetryableStatus = (status: number) => status === 429 || status >= 500

export class AzureDocumentIntelligenceAdapter implements ExtractionAdapter {
  readonly provider = 'azure' as const

  private readonly fetchImpl: typeof fetch
  private readonly pollIntervalMs: number
  private readonly maxAttempts: number

  constructor(
    private readonly config: AppConfig,
    options: AzureAdapterOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000
    this.maxAttempts = options.maxAttempts ?? 3
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const startedAt = Date.now()
    const { endpoint, key, modelId, apiVersion, timeoutMs } = this.config.azure

    if (!endpoint || !key) {
      return {
        ok: false,
        provider: this.provider,
        kind: 'not_configured',
        message:
          'EXTRACTION_PROVIDER is set to azure but AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or AZURE_DOCUMENT_INTELLIGENCE_KEY is missing.',
        durationMs: Date.now() - startedAt,
        attempts: 0,
      }
    }

    /**
     * Key-value pairs are an opt-in feature on the layout model in API v4.0.
     *
     * `prebuilt-document` used to return them by default, but it was removed
     * in `2024-11-30`; the capability moved to `prebuilt-layout` behind
     * `features=keyValuePairs`. Requesting layout without the flag returns 200
     * and no key-value pairs at all, which would look like a document the
     * service simply could not read — a far more expensive bug to chase than
     * the 404 that sent us here.
     *
     * Custom-trained models return their own fields and reject the flag, so it
     * is only added for the prebuilt models that accept it.
     */
    const wantsKeyValuePairs = /^prebuilt-(layout|document)$/.test(modelId)

    const analyzeUrl =
      `${endpoint}/documentintelligence/documentModels/${encodeURIComponent(modelId)}:analyze` +
      `?api-version=${encodeURIComponent(apiVersion)}` +
      (wantsKeyValuePairs ? '&features=keyValuePairs' : '')

    // One deadline for the whole operation — submit plus polling. A per-request
    // timeout would let a slow poll loop run indefinitely.
    const deadline = startedAt + timeoutMs
    let attempts = 0
    let lastError = 'Unknown error.'

    while (attempts < this.maxAttempts) {
      attempts += 1

      if (Date.now() >= deadline) {
        return this.timeout(startedAt, attempts, timeoutMs)
      }

      try {
        const submitted = await this.withDeadline(
          deadline,
          (signal) =>
            this.fetchImpl(analyzeUrl, {
              method: 'POST',
              headers: {
                'Ocp-Apim-Subscription-Key': key,
                'Content-Type': input.mimeType || 'application/octet-stream',
              },
              body: input.bytes,
              signal,
            }),
        )

        if (!submitted.ok) {
          lastError = `Document Intelligence returned ${submitted.status} ${submitted.statusText}.`
          if (isRetryableStatus(submitted.status) && attempts < this.maxAttempts) {
            await this.backoff(attempts, deadline)
            continue
          }
          return {
            ok: false,
            provider: this.provider,
            kind: 'service_error',
            message: `${lastError} after ${attempts} attempt(s).`,
            durationMs: Date.now() - startedAt,
            attempts,
          }
        }

        // 202 Accepted + Operation-Location is the long-running-operation path.
        const operationUrl = submitted.headers.get('operation-location')
        const payload = operationUrl
          ? await this.poll(operationUrl, key, deadline)
          : await submitted.json()

        if (payload === 'timeout') {
          return this.timeout(startedAt, attempts, timeoutMs)
        }

        const validated = azureAnalyzeResultSchema.safeParse(payload)
        if (!validated.success) {
          return {
            ok: false,
            provider: this.provider,
            kind: 'malformed_response',
            message: `Document Intelligence response did not match the expected shape: ${validated.error.issues
              .map((i) => `${i.path.join('.')} ${i.message}`)
              .join('; ')}`,
            durationMs: Date.now() - startedAt,
            attempts,
          }
        }

        const normalized = normalizeAzureResult(validated.data)
        if (!normalized.ok || !normalized.data) {
          return {
            ok: false,
            provider: this.provider,
            kind: 'malformed_response',
            message: normalized.error ?? 'Extraction could not be normalized.',
            durationMs: Date.now() - startedAt,
            attempts,
          }
        }

        return {
          ok: true,
          provider: this.provider,
          data: normalized.data,
          durationMs: Date.now() - startedAt,
          modelId,
        }
      } catch (error) {
        const aborted =
          error instanceof Error &&
          (error.name === 'AbortError' || error.name === 'TimeoutError')

        if (aborted) {
          return this.timeout(startedAt, attempts, timeoutMs)
        }

        lastError = error instanceof Error ? error.message : String(error)
        if (attempts < this.maxAttempts) {
          await this.backoff(attempts, deadline)
          continue
        }
      }
    }

    return {
      ok: false,
      provider: this.provider,
      kind: 'service_error',
      message: `Document Intelligence request failed after ${attempts} attempt(s): ${lastError}`,
      durationMs: Date.now() - startedAt,
      attempts,
    }
  }

  // -- helpers -------------------------------------------------------------

  private timeout(
    startedAt: number,
    attempts: number,
    timeoutMs: number,
  ): ExtractionResult {
    return {
      ok: false,
      provider: this.provider,
      kind: 'timeout',
      message: `Document Intelligence request timed out after ${timeoutMs} ms.`,
      durationMs: Date.now() - startedAt,
      attempts,
    }
  }

  private async withDeadline<T>(
    deadline: number,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const remaining = Math.max(0, deadline - Date.now())
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remaining)
    try {
      return await run(controller.signal)
    } finally {
      clearTimeout(timer)
    }
  }

  private async backoff(attempt: number, deadline: number): Promise<void> {
    const delay = Math.min(
      this.pollIntervalMs * 2 ** (attempt - 1),
      Math.max(0, deadline - Date.now()),
    )
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  }

  /** Polls the operation until it succeeds, fails, or the deadline passes. */
  private async poll(
    operationUrl: string,
    key: string,
    deadline: number,
  ): Promise<unknown | 'timeout'> {
    while (Date.now() < deadline) {
      const response = await this.withDeadline(deadline, (signal) =>
        this.fetchImpl(operationUrl, {
          headers: { 'Ocp-Apim-Subscription-Key': key },
          signal,
        }),
      )

      if (!response.ok) {
        throw new Error(
          `Polling the analyze operation returned ${response.status} ${response.statusText}.`,
        )
      }

      const payload = (await response.json()) as { status?: string; error?: { message?: string } }

      if (payload.status === 'succeeded') return payload
      if (payload.status === 'failed') {
        throw new Error(
          payload.error?.message ?? 'The analyze operation reported failure.',
        )
      }

      const wait = Math.min(this.pollIntervalMs, Math.max(0, deadline - Date.now()))
      if (wait <= 0) break
      await new Promise((resolve) => setTimeout(resolve, wait))
    }

    return 'timeout'
  }
}
