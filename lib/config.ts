/**
 * Runtime configuration (BR-014, BR-017, IR-002).
 *
 * SERVER-ONLY. Nothing here is prefixed `NEXT_PUBLIC_`, so none of it reaches
 * the client bundle (NFR-001). The intake and dashboard learn the active
 * extraction provider from an API response, never by reading configuration
 * directly.
 *
 * The tunable business thresholds live here rather than in the rules code
 * because they are operational dials — the confidence threshold in particular
 * is the primary lever between automation benefit and error risk, and changing
 * it must not require a deployment of new logic.
 */

import type { ExtractionProvider } from './domain/enums'

/**
 * Minimal read-only view of the environment. Narrower than `NodeJS.ProcessEnv`
 * on purpose: a test supplies exactly the variables under test without having
 * to satisfy the ambient shape of the real process environment.
 */
export type EnvSource = Record<string, string | undefined>

export interface AppConfig {
  /** Resolved extraction provider. `auto` is resolved here, not downstream. */
  extractionProvider: ExtractionProvider
  /** What `EXTRACTION_PROVIDER` was set to, for diagnostics. */
  configuredProvider: string
  azure: {
    endpoint: string
    key: string
    modelId: string
    apiVersion: string
    timeoutMs: number
  }
  /** Inclusive. Confidence >= this value is accepted without review (AC-006). */
  confidenceThreshold: number
  duplicateWindowDays: number
  maxUploadBytes: number
  notificationProvider: string
  notificationFrom: string
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function str(value: string | undefined, fallback = ''): string {
  return value?.trim() ?? fallback
}

/**
 * Reads configuration from the environment on every call rather than caching
 * at module load, so a test can set an environment variable and observe the
 * effect without resetting the module registry.
 */
export function getConfig(env: EnvSource = process.env): AppConfig {
  const endpoint = str(env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT).replace(/\/+$/, '')
  const key = str(env.AZURE_DOCUMENT_INTELLIGENCE_KEY)
  const configured = str(env.EXTRACTION_PROVIDER, 'auto').toLowerCase()

  const azureConfigured = endpoint !== '' && key !== ''

  let provider: ExtractionProvider
  if (configured === 'azure') {
    // Explicit request for Azure. If credentials are absent the adapter fails
    // loudly at call time rather than silently degrading to fixtures — an
    // operator who asked for Azure should be told it is not usable.
    provider = 'azure'
  } else if (configured === 'fixture') {
    provider = 'fixture'
  } else {
    provider = azureConfigured ? 'azure' : 'fixture'
  }

  return {
    extractionProvider: provider,
    configuredProvider: configured,
    azure: {
      endpoint,
      key,
      modelId: str(env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID, 'prebuilt-document'),
      apiVersion: str(env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION, '2024-11-30'),
      timeoutMs: num(env.AZURE_REQUEST_TIMEOUT_MS, 30_000),
    },
    confidenceThreshold: clamp01(num(env.EXTRACTION_CONFIDENCE_THRESHOLD, 0.8)),
    duplicateWindowDays: Math.max(0, num(env.DUPLICATE_WINDOW_DAYS, 30)),
    maxUploadBytes: Math.max(1, num(env.MAX_UPLOAD_MB, 10)) * 1024 * 1024,
    notificationProvider: str(env.NOTIFICATION_PROVIDER, 'log'),
    notificationFrom: str(env.NOTIFICATION_FROM_ADDRESS, 'intake@example.com'),
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Non-secret configuration safe to send to the browser. Deliberately explicit:
 * a new secret added to `AppConfig` cannot leak into a client payload by
 * accident, because it would have to be added here by hand.
 */
export interface PublicConfig {
  extractionProvider: ExtractionProvider
  isDemoMode: boolean
  confidenceThreshold: number
  duplicateWindowDays: number
  maxUploadMb: number
}

export function toPublicConfig(config: AppConfig): PublicConfig {
  return {
    extractionProvider: config.extractionProvider,
    isDemoMode: config.extractionProvider === 'fixture',
    confidenceThreshold: config.confidenceThreshold,
    duplicateWindowDays: config.duplicateWindowDays,
    maxUploadMb: Math.round(config.maxUploadBytes / (1024 * 1024)),
  }
}
