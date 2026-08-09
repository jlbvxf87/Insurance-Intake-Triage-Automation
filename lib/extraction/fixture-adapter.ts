/**
 * Fixture extraction adapter (FR-026, IR-001).
 *
 * Satisfies the same contract as the Azure adapter and returns the same
 * normalized shape. Every result it produces is labelled `provider: 'fixture'`,
 * and the UI surfaces that label, so demo output is never presented as a live
 * Azure call.
 */

import { normalizedExtractionSchema } from '../domain/schemas'
import { selectFailureTrigger, selectFixture } from './fixtures'
import type {
  ExtractionAdapter,
  ExtractionFailureKind,
  ExtractionInput,
  ExtractionResult,
} from './types'

export class FixtureExtractionAdapter implements ExtractionAdapter {
  readonly provider = 'fixture' as const

  /**
   * @param latencyMs Simulated processing delay. Kept short — a demo should
   *   feel like the system is doing work, not like it is broken. Zero in tests.
   */
  constructor(private readonly latencyMs = 450) {}

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const startedAt = Date.now()

    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs))
    }

    // File names can deliberately trigger a failure path so the exception
    // handling is demonstrable without breaking a real service.
    const trigger = selectFailureTrigger(input.fileName)
    if (trigger) {
      return {
        ok: false,
        provider: this.provider,
        kind: trigger.kind,
        message: trigger.message,
        durationMs: Date.now() - startedAt,
        attempts: trigger.kind === 'service_error' ? 3 : 1,
      }
    }

    const fixture = selectFixture(input.fileName)

    // Parsed through the same schema as a live response. A malformed fixture
    // should fail here rather than reaching the workflow as trusted data.
    const parsed = normalizedExtractionSchema.safeParse(fixture.data)
    if (!parsed.success) {
      return {
        ok: false,
        provider: this.provider,
        kind: 'malformed_response',
        message: `Fixture "${fixture.id}" failed schema validation.`,
        durationMs: Date.now() - startedAt,
        attempts: 1,
      }
    }

    return {
      ok: true,
      provider: this.provider,
      data: parsed.data,
      durationMs: Date.now() - startedAt,
      modelId: `fixture:${fixture.id}`,
    }
  }
}

/**
 * Adapter that always fails with a chosen kind. Used to exercise TC-08,
 * TC-08b, and TC-08c without touching production code paths.
 */
export class FailingExtractionAdapter implements ExtractionAdapter {
  readonly provider = 'fixture' as const

  constructor(
    private readonly kind: ExtractionFailureKind = 'service_error',
    private readonly message = 'Simulated extraction failure.',
  ) {}

  async extract(): Promise<ExtractionResult> {
    return {
      ok: false,
      provider: this.provider,
      kind: this.kind,
      message: this.message,
      durationMs: 0,
      attempts: 1,
    }
  }
}
