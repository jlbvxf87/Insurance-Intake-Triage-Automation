/**
 * Constrained option sets (DR-005).
 *
 * Every one of these corresponds to a Dataverse Choice column. The string
 * values are the labels; the numeric option-set values used by Dataverse are
 * documented in `dataverse/schema.md` and kept in sync there so the reference
 * implementation and the Power Platform implementation share one vocabulary
 * (IR-006).
 *
 * Pattern: a frozen tuple provides the runtime list (for iteration, select
 * options, and Zod enums) and the derived union provides the compile-time
 * type. One declaration, both uses — they cannot drift.
 */

/** How the client is classified. */
export const CLIENT_TYPES = ['Individual', 'Commercial', 'Broker'] as const
export type ClientType = (typeof CLIENT_TYPES)[number]

/** What the submitter is asking for. */
export const SUBMISSION_TYPES = ['Quote', 'Claim'] as const
export type SubmissionType = (typeof SUBMISSION_TYPES)[number]

/**
 * Lines of business the intake accepts. `Other` is a real, selectable value
 * that routes to General Intake by rule (BR-005) — distinct from a line of
 * business the rules table does not recognize at all (BR-006), which can only
 * arrive from an upstream system.
 */
export const LINES_OF_BUSINESS = [
  'Commercial Auto',
  'Property',
  'General Liability',
  'Workers Compensation',
  'Other',
] as const
export type LineOfBusiness = (typeof LINES_OF_BUSINESS)[number]

/** Submission lifecycle. See `docs/future-state.md` §6 for the state diagram. */
export const SUBMISSION_STATUSES = [
  'New',
  'Processing',
  'Routed',
  'In Review',
  'Duplicate',
  'Exception',
  'Closed',
] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

/** Internal teams a submission can be assigned to. */
export const ASSIGNED_TEAMS = [
  'Auto Team',
  'Property Team',
  'Casualty Team',
  'WC Team',
  'General Intake',
  'Unassigned',
] as const
export type AssignedTeam = (typeof ASSIGNED_TEAMS)[number]

/** How the submission entered the system. */
export const SUBMISSION_SOURCES = [
  'Web Intake',
  'Email',
  'Phone',
  'Broker Portal',
] as const
export type SubmissionSource = (typeof SUBMISSION_SOURCES)[number]

/** Policy type as read from a document — distinct from the submitted line of business. */
export const POLICY_TYPES = [
  'Commercial Auto',
  'Commercial Property',
  'General Liability',
  'Workers Compensation',
  'Umbrella',
  'Unknown',
] as const
export type PolicyType = (typeof POLICY_TYPES)[number]

/**
 * Trust level of an extraction result (BR-019).
 *
 * `Validated`      — schema passed, required fields present, confidence >= threshold
 * `Unverified`     — usable values, but confidence below threshold; needs a human
 * `Failed`         — schema invalid or a required field missing
 * `Not Applicable` — no document was supplied, so there is nothing to validate
 */
export const VALIDATION_STATUSES = [
  'Validated',
  'Unverified',
  'Failed',
  'Not Applicable',
] as const
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]

/** Terminal status of a workflow run. */
export const AUTOMATION_RUN_STATUSES = [
  'Succeeded',
  'Needs Review',
  'Failed',
] as const
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number]

/**
 * Named workflow steps. Recorded on failure as `stepFailed` so a log entry
 * identifies exactly where a run stopped (FR-009) rather than only that it did.
 */
export const WORKFLOW_STEPS = [
  'Validate Submission',
  'Resolve Client',
  'Duplicate Check',
  'Extract Document',
  'Validate Extraction',
  'Apply Business Rules',
  'Persist Records',
  'Send Confirmation',
  'Write Audit Log',
] as const
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number]

/**
 * Why a submission needs a human. Multiple reasons can apply to one
 * submission; the final status is decided by the precedence order in BR-020.
 */
export const REVIEW_REASONS = [
  'Low Confidence',
  'Possible Duplicate',
  'Missing Required Data',
  'Unknown Routing Rule',
  'Extraction Failure',
  'Policy Type Mismatch',
] as const
export type ReviewReason = (typeof REVIEW_REASONS)[number]

/** Which adapter produced an extraction (DR-009). Surfaced in the UI (FR-026). */
export const EXTRACTION_PROVIDERS = ['azure', 'fixture'] as const
export type ExtractionProvider = (typeof EXTRACTION_PROVIDERS)[number]

/** File types the intake accepts (FR-014). */
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
] as const
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number]

export const ACCEPTED_FILE_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.tif',
  '.tiff',
] as const
