/**
 * Domain entities (DR-001 – DR-004).
 *
 * These are the four tables from `dataverse/schema.md`, expressed in
 * TypeScript. Field names match the Dataverse logical names one-for-one so the
 * reference implementation and the documented Power Platform implementation
 * describe the same model (IR-006).
 *
 * Dates are ISO-8601 strings rather than `Date` objects: they cross the
 * client/server boundary as JSON, and a string that is always a string is
 * easier to reason about than a value that is a `Date` on one side of a
 * `fetch` and a string on the other.
 */

import type {
  AssignedTeam,
  AutomationRunStatus,
  ClientType,
  ExtractionProvider,
  LineOfBusiness,
  PolicyType,
  ReviewReason,
  SubmissionSource,
  SubmissionStatus,
  SubmissionType,
  ValidationStatus,
  WorkflowStep,
} from './enums'

/** ISO-8601 timestamp, e.g. `2026-08-09T14:22:31.000Z`. */
export type IsoDateTime = string

/** ISO-8601 calendar date, e.g. `2026-01-01`. */
export type IsoDate = string

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface Client {
  /** Primary key. Format `CLI-####`. */
  clientId: string
  /** Contact name. */
  clientName: string
  companyName: string
  /** As entered. Matching uses the normalized form — see `normalizedEmail`. */
  email: string
  phone: string
  clientType: ClientType
  createdDate: IsoDateTime
  active: boolean
  /**
   * Trimmed, lower-cased email. Stored rather than derived at query time so
   * matching is a key lookup instead of a scan, and so the match key is
   * inspectable when a match is disputed (FR-017, DR-006).
   */
  normalizedEmail: string
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export interface Submission {
  /** Primary key. Format `SUB-#####`. Shown to the submitter as their reference. */
  submissionId: string
  /** Lookup → Client. One client has many submissions (DR-002). */
  clientId: string
  submissionType: SubmissionType
  lineOfBusiness: LineOfBusiness
  description: string
  dateReceived: IsoDateTime
  status: SubmissionStatus
  assignedTeam: AssignedTeam

  /** True when a prior submission satisfies BR-013. */
  duplicateFlag: boolean
  /** Human-readable explanation of the duplicate flag (FR-020). Null when not flagged. */
  duplicateReason: string | null
  /** Id of the submission this one may duplicate. Null when not flagged. */
  duplicateOfSubmissionId: string | null

  /**
   * Aggregate extraction confidence, 0–1. Null when no document was supplied —
   * meaningfully different from 0, which would mean "extracted, no confidence".
   */
  confidenceScore: number | null

  needsHumanReview: boolean
  /** Every applicable reason, not only the one that decided the status (BR-020). */
  reviewReasons: ReviewReason[]

  source: SubmissionSource

  /** Metadata about the uploaded file. The bytes are never persisted (DR-008). */
  originalDocument: DocumentMetadata | null
}

export interface DocumentMetadata {
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: IsoDateTime
}

// ---------------------------------------------------------------------------
// ExtractedPolicyData
// ---------------------------------------------------------------------------

export interface ExtractedPolicyData {
  /** Primary key. Format `EXT-#####`. */
  extractionId: string
  /** Lookup → Submission. One-to-one (DR-003). */
  submissionId: string

  carrier: string | null
  policyNumber: string | null
  effectiveDate: IsoDate | null
  expirationDate: IsoDate | null
  namedInsured: string | null
  policyType: PolicyType
  coverageAmount: number | null

  /** Aggregate confidence, 0–1. */
  extractionConfidence: number
  /**
   * Per-field confidence, retained so a reviewer can see *which* field was
   * weak rather than only that the aggregate was low (BR-018).
   */
  fieldConfidence: Record<string, number>

  validationStatus: ValidationStatus
  /** Required fields absent from the result. Empty when validation passed. */
  missingFields: string[]

  /** Which adapter produced this result (DR-009, FR-026). */
  provider: ExtractionProvider
  extractedAt: IsoDateTime
}

// ---------------------------------------------------------------------------
// AutomationLog
// ---------------------------------------------------------------------------

export interface AutomationLog {
  /** Primary key. Format `LOG-#####`. */
  logId: string
  /** Lookup → Submission. One submission has many runs (DR-004). */
  submissionId: string
  workflowName: string
  /** Correlation id for one execution. Groups entries from the same run. */
  runId: string

  started: IsoDateTime
  completed: IsoDateTime | null
  status: AutomationRunStatus

  /** The step that failed. Null on success (FR-009). */
  stepFailed: WorkflowStep | null
  errorMessage: string | null
  retryCount: number

  /** Ordered trace of every step attempted in this run (NFR-007). */
  steps: AutomationStepRecord[]
  /** Milliseconds from `started` to `completed`. Null while the run is open. */
  durationMs: number | null
}

export interface AutomationStepRecord {
  step: WorkflowStep
  outcome: 'ok' | 'skipped' | 'failed'
  /** Short human-readable note, e.g. "No document supplied — extraction skipped". */
  detail: string
  at: IsoDateTime
  durationMs: number
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

/**
 * Acknowledgement emitted on successful routing (FR-008, FR-031). Recorded as
 * an event whether or not a mail transport is configured, so the workflow is
 * verifiable without one.
 */
export interface ConfirmationEvent {
  submissionId: string
  toEmail: string
  toName: string
  assignedTeam: AssignedTeam
  sentAt: IsoDateTime
  /** `log` when no transport is configured. */
  transport: string
  subject: string
  body: string
}

// ---------------------------------------------------------------------------
// Aggregate view
// ---------------------------------------------------------------------------

/** A submission with its related records, as the operations dashboard reads it. */
export interface SubmissionDetail {
  submission: Submission
  client: Client
  extraction: ExtractedPolicyData | null
  logs: AutomationLog[]
}
