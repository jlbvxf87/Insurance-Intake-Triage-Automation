/**
 * Extraction adapter contract (IR-001, IR-002).
 *
 * One interface, two implementations. `AzureDocumentIntelligenceAdapter` calls
 * the real service; `FixtureExtractionAdapter` returns deterministic local
 * data. Both return the same normalized shape, so nothing downstream knows or
 * cares which one ran — switching between them is configuration, not code.
 *
 * That symmetry is also what makes the failure matrix testable: a third
 * implementation that throws on demand exercises every exception path without
 * touching production code.
 */

import type { NormalizedExtraction } from '../domain/schemas'
import type { ExtractionProvider } from '../domain/enums'

export interface ExtractionInput {
  fileName: string
  mimeType: string
  sizeBytes: number
  bytes: ArrayBuffer
}

export interface ExtractionSuccess {
  ok: true
  provider: ExtractionProvider
  data: NormalizedExtraction
  /** Milliseconds spent in the adapter, recorded on the workflow run. */
  durationMs: number
  /** Model or fixture identifier, for provenance. */
  modelId: string
}

/** Failure taxonomy. Each maps to a distinct operational cause (BR-009). */
export type ExtractionFailureKind =
  | 'timeout'
  | 'service_error'
  | 'malformed_response'
  | 'unsupported_document'
  | 'not_configured'

export interface ExtractionFailure {
  ok: false
  provider: ExtractionProvider
  kind: ExtractionFailureKind
  message: string
  durationMs: number
  /** Attempts made, including the first. Recorded as `retryCount - 1`. */
  attempts: number
}

export type ExtractionResult = ExtractionSuccess | ExtractionFailure

export interface ExtractionAdapter {
  readonly provider: ExtractionProvider
  /**
   * Never throws. Every failure mode is returned as an `ExtractionFailure` so
   * the orchestrator classifies outcomes in one place instead of splitting
   * that logic between a return value and a catch block.
   */
  extract(input: ExtractionInput): Promise<ExtractionResult>
}
