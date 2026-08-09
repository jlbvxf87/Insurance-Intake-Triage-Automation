/**
 * Intake workflow orchestrator (FR-003 – FR-012, BR-007 – BR-020).
 *
 * Shaped as TRY / CATCH / FINALLY, mirroring the Power Automate flow documented
 * in `power-automate/workflow.md`:
 *
 *   TRY      validate → resolve client → persist → duplicate check → extract
 *            → validate extraction → apply rules → update → confirm
 *   CATCH    classify the failure, set status Exception, record the step
 *   FINALLY  write the automation log, always
 *
 * Everything the orchestrator needs is injected: the repository, the extraction
 * adapter, configuration, and the clock. That is what lets every branch in the
 * failure matrix be exercised without network access, a database, or fake
 * timers (NFR-016).
 *
 * Invariants this function is responsible for:
 *  - No submission is left in `Processing` when it returns (NFR-005).
 *  - Exactly one automation log is written per run, whatever happens (FR-032).
 *  - No exception escapes (AC-014).
 */

import type { AppConfig } from '../config'
import type { IntakeFormValues, SubmissionResponse } from '../domain/schemas'
import { findMissingRequiredFields } from '../domain/schemas'
import type {
  AutomationLog,
  Client,
  ConfirmationEvent,
  ExtractedPolicyData,
  Submission,
} from '../domain/types'
import type { ReviewReason, SubmissionStatus, ValidationStatus } from '../domain/enums'
import type { Repository } from '../data/repository'
import { createExtractionAdapter } from '../extraction'
import type { ExtractionAdapter, ExtractionResult } from '../extraction/types'
import { newClientId, newExtractionId, newSubmissionId } from '../utils/ids'
import { nowIso } from '../utils/dates'
import { normalizeEmail } from '../utils/normalize'
import {
  detectPolicyTypeMismatch,
  isBelowConfidenceThreshold,
  resolveOutcome,
  resolveTeam,
} from './business-rules'
import { checkForDuplicate } from './duplicate-detection'
import { buildConfirmation, shouldSendConfirmation } from './notifications'
import { RunLogger, runStatusFor } from './run-logger'

export interface WorkflowDocument {
  fileName: string
  mimeType: string
  sizeBytes: number
  bytes: ArrayBuffer
}

export interface WorkflowInput {
  input: IntakeFormValues
  document: WorkflowDocument | null
  repository: Repository
  config: AppConfig
  /** Injected in tests; resolved from configuration otherwise. */
  extractor?: ExtractionAdapter
  /** Injected in tests so duplicate-window boundaries are controllable. */
  now?: string
}

export interface WorkflowResult {
  response: SubmissionResponse
  submissionId: string
  status: SubmissionStatus
  client: Client | null
  submission: Submission | null
  extraction: ExtractedPolicyData | null
  confirmation: ConfirmationEvent | null
  log: AutomationLog
}

export async function runIntakeWorkflow(
  options: WorkflowInput,
): Promise<WorkflowResult> {
  const { input, document, repository, config } = options
  const now = options.now ?? nowIso()
  const extractor = options.extractor ?? createExtractionAdapter(config)
  const log = new RunLogger()

  // Allocated up front so the audit log can reference the submission even if
  // the very first write fails (AC-014). A run without an id would be an
  // orphaned log entry no one could trace.
  const submissionId = newSubmissionId()

  let client: Client | null = null
  let submission: Submission | null = null
  let extraction: ExtractedPolicyData | null = null
  let confirmation: ConfirmationEvent | null = null

  let status: SubmissionStatus = 'New'
  let needsHumanReview = false
  let reviewReasons: ReviewReason[] = []
  let duplicateFlag = false
  let confidenceScore: number | null = null
  let extractionProvider: string | null = null
  let record: AutomationLog
  let assignedTeam: Submission['assignedTeam'] = 'Unassigned'

  try {
    // -- 1. Validate ------------------------------------------------------
    // The API route has already parsed the payload; this records the step and
    // captures the normalized values the rest of the run uses.
    const normalizedEmail = normalizeEmail(input.email)
    log.ok(
      'Validate Submission',
      `Fields validated. Email normalized to ${normalizedEmail}.`,
    )

    // -- 2. Resolve client (FR-003, FR-017, FR-018) -----------------------
    const existing = await repository.findClientByNormalizedEmail(normalizedEmail)

    if (existing) {
      client = existing
      log.ok('Resolve Client', `Matched existing client ${existing.clientId} on normalized email.`)
    } else {
      client = await repository.createClient({
        clientId: newClientId(),
        clientName: input.clientName,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        clientType: 'Commercial',
        createdDate: now,
        active: true,
        normalizedEmail,
      })
      log.ok('Resolve Client', `No match found. Created client ${client.clientId}.`)
    }

    // -- 3. Persist the submission ----------------------------------------
    // Written as `Processing` before any slow work begins, so a submission is
    // never lost if the process dies mid-run — it is visible in the queue in a
    // state that says a run was underway.
    status = 'Processing'
    submission = await repository.createSubmission({
      submissionId,
      clientId: client.clientId,
      submissionType: input.submissionType,
      lineOfBusiness: input.lineOfBusiness,
      description: input.description,
      dateReceived: now,
      status,
      assignedTeam: 'Unassigned',
      duplicateFlag: false,
      duplicateReason: null,
      duplicateOfSubmissionId: null,
      confidenceScore: null,
      needsHumanReview: false,
      reviewReasons: [],
      source: 'Web Intake',
      originalDocument: document
        ? {
            fileName: document.fileName,
            mimeType: document.mimeType,
            sizeBytes: document.sizeBytes,
            uploadedAt: now,
          }
        : null,
    })

    // -- 4. Duplicate check (FR-004, BR-013) ------------------------------
    const candidates = await repository.findDuplicateCandidates({
      clientId: client.clientId,
      submissionType: input.submissionType,
      lineOfBusiness: input.lineOfBusiness,
    })

    const duplicate = checkForDuplicate({
      candidates,
      submissionType: input.submissionType,
      lineOfBusiness: input.lineOfBusiness,
      now,
      windowDays: config.duplicateWindowDays,
      excludeSubmissionId: submissionId,
    })

    duplicateFlag = duplicate.isDuplicate
    log.ok(
      'Duplicate Check',
      duplicate.isDuplicate
        ? `Possible duplicate of ${duplicate.duplicateOfSubmissionId}.`
        : `No duplicate found among ${candidates.length} candidate(s) inside a ${config.duplicateWindowDays}-day window.`,
    )

    // -- 5. Extraction (FR-005, BR-009) -----------------------------------
    let extractionResult: ExtractionResult | null = null

    if (document) {
      extractionResult = await extractor.extract(document)
      extractionProvider = extractionResult.provider

      if (extractionResult.ok) {
        log.ok(
          'Extract Document',
          `Extracted with ${extractionResult.provider} (${extractionResult.modelId}) in ${extractionResult.durationMs} ms.`,
        )
      } else {
        log.failed(
          'Extract Document',
          `${extractionResult.kind}: ${extractionResult.message}`,
          Math.max(0, extractionResult.attempts - 1),
        )
      }
    } else {
      log.skipped('Extract Document', 'No document supplied — extraction skipped.')
      log.skipped('Validate Extraction', 'No extraction to validate.')
    }

    // -- 6. Validate the extraction (FR-023, BR-007, BR-010, BR-019) ------
    let isLowConfidence = false
    let hasMissingRequiredData = false
    let hasPolicyTypeMismatch = false
    let missingFields: string[] = []
    let validationStatus: ValidationStatus = 'Not Applicable'

    if (extractionResult?.ok) {
      const data = extractionResult.data
      confidenceScore = data.extractionConfidence

      missingFields = findMissingRequiredFields(data)
      hasMissingRequiredData = missingFields.length > 0
      isLowConfidence = isBelowConfidenceThreshold(
        data.extractionConfidence,
        config.confidenceThreshold,
      )
      hasPolicyTypeMismatch = detectPolicyTypeMismatch(
        input.lineOfBusiness,
        data.policyType,
      )

      validationStatus = hasMissingRequiredData
        ? 'Failed'
        : isLowConfidence
          ? 'Unverified'
          : 'Validated'

      // Values are retained regardless of validation status (FR-024). A
      // low-confidence policy number is still the best starting point a
      // reviewer has — discarding it would send them back to the document.
      extraction = await repository.createExtraction({
        extractionId: newExtractionId(),
        submissionId,
        carrier: data.carrier,
        policyNumber: data.policyNumber,
        effectiveDate: data.effectiveDate,
        expirationDate: data.expirationDate,
        namedInsured: data.namedInsured,
        policyType: data.policyType,
        coverageAmount: data.coverageAmount,
        extractionConfidence: data.extractionConfidence,
        fieldConfidence: data.fieldConfidence,
        validationStatus,
        missingFields,
        provider: extractionResult.provider,
        extractedAt: now,
      })

      log.ok(
        'Validate Extraction',
        `Confidence ${data.extractionConfidence.toFixed(2)} against threshold ${config.confidenceThreshold.toFixed(2)}. ` +
          `Validation status ${validationStatus}.` +
          (hasMissingRequiredData ? ` Missing: ${missingFields.join(', ')}.` : '') +
          (hasPolicyTypeMismatch
            ? ` Extracted policy type "${data.policyType}" does not match submitted line of business "${input.lineOfBusiness}".`
            : ''),
      )
    } else if (extractionResult) {
      log.ok('Validate Extraction', 'Extraction failed — nothing to validate.')
    }

    // -- 7. Business rules (FR-007, BR-001 – BR-006, BR-020) --------------
    const routing = resolveTeam(input.lineOfBusiness)
    assignedTeam = routing.team

    const outcome = resolveOutcome({
      hasWorkflowError: Boolean(extractionResult && !extractionResult.ok),
      isPossibleDuplicate: duplicate.isDuplicate,
      isLowConfidence,
      hasMissingRequiredData,
      hasUnknownRouting: !routing.matched,
      hasPolicyTypeMismatch,
    })

    status = outcome.status
    needsHumanReview = outcome.needsHumanReview
    reviewReasons = outcome.reviewReasons

    // An exception leaves the submission unassigned: no team owns a
    // submission whose data could not be established.
    if (status === 'Exception') assignedTeam = 'Unassigned'

    log.ok(
      'Apply Business Rules',
      `${input.lineOfBusiness} → ${assignedTeam}` +
        (routing.matched ? '' : ' (no matching rule — General Intake + review)') +
        `. Outcome ${status}.` +
        (reviewReasons.length ? ` Reasons: ${reviewReasons.join(', ')}.` : ''),
    )

    // -- 8. Persist the outcome -------------------------------------------
    submission = await repository.updateSubmission(submissionId, {
      status,
      assignedTeam,
      duplicateFlag: duplicate.isDuplicate,
      duplicateReason: duplicate.reason,
      duplicateOfSubmissionId: duplicate.duplicateOfSubmissionId,
      confidenceScore,
      needsHumanReview,
      reviewReasons,
    })

    log.ok('Persist Records', `Submission ${submissionId} updated to ${status}.`)

    // -- 9. Confirmation (FR-008, FR-031) ---------------------------------
    if (shouldSendConfirmation(status)) {
      confirmation = buildConfirmation({
        submissionId,
        toEmail: client.email,
        toName: client.clientName,
        assignedTeam,
        submissionType: input.submissionType,
        lineOfBusiness: input.lineOfBusiness,
        transport: config.notificationProvider,
        at: now,
      })
      log.ok(
        'Send Confirmation',
        `Acknowledgement generated for ${client.email} via ${config.notificationProvider}.`,
      )
    } else {
      log.skipped(
        'Send Confirmation',
        `Status ${status} — no routing confirmation sent to the submitter.`,
      )
    }
  } catch (error) {
    // -- CATCH (BR-011, NFR-005, AC-014) ----------------------------------
    const message = error instanceof Error ? error.message : String(error)
    const step = submission ? 'Persist Records' : 'Resolve Client'

    log.failed(step, message)

    status = 'Exception'
    needsHumanReview = true
    reviewReasons = ['Extraction Failure']
    assignedTeam = 'Unassigned'

    // Best-effort: move the record out of `Processing` so it appears in the
    // Exceptions queue. If this write also fails the log below is still
    // written, so the failure is visible either way — the one thing that must
    // not happen is a silent loss.
    if (submission) {
      try {
        submission = await repository.updateSubmission(submissionId, {
          status,
          assignedTeam,
          needsHumanReview,
          reviewReasons,
        })
      } catch {
        log.failed(
          'Persist Records',
          'Could not update the submission to Exception status after the initial failure.',
        )
      }
    }
  } finally {
    // -- FINALLY (FR-032, FR-034) -----------------------------------------
    // Runs on every path. A run that produced no log would be a run nobody
    // could audit, which is the failure this whole layer exists to prevent.
    //
    // Deliberately does NOT return from here: a `return` inside `finally`
    // swallows anything still propagating, which would turn a future bug in
    // the catch block into silence. The record is assigned and the function
    // returns below.
    record = log.finish(submissionId, runStatusFor(status))
    try {
      await repository.createLog(record)
    } catch {
      // The log store itself failed. Nothing further can be recorded through
      // it; the record is still returned to the caller so the failure is not
      // invisible. A production deployment would want a second sink here —
      // see power-automate/error-handling.md §3, row 17.
    }
  }

  return {
    response: buildResponse({
      submissionId,
      status,
      assignedTeam,
      needsHumanReview,
      reviewReasons,
      duplicateFlag,
      confidenceScore,
      extractionProvider,
    }),
    submissionId,
    status,
    client,
    submission,
    extraction,
    confirmation,
    log: record,
  }
}

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------

function buildResponse(args: {
  submissionId: string
  status: SubmissionStatus
  assignedTeam: string
  needsHumanReview: boolean
  reviewReasons: string[]
  duplicateFlag: boolean
  confidenceScore: number | null
  extractionProvider: string | null
}): SubmissionResponse {
  return {
    submissionId: args.submissionId,
    status: args.status,
    assignedTeam: args.assignedTeam,
    needsHumanReview: args.needsHumanReview,
    reviewReasons: args.reviewReasons,
    duplicateFlag: args.duplicateFlag,
    confidenceScore: args.confidenceScore,
    extractionProvider: args.extractionProvider,
    message: messageFor(args.status, args.assignedTeam, args.reviewReasons),
  }
}

/**
 * Submitter-facing summary. Says what actually happened rather than a generic
 * acknowledgement — including when a person will be looking at it, which sets
 * the right expectation about turnaround.
 */
function messageFor(
  status: SubmissionStatus,
  assignedTeam: string,
  reasons: string[],
): string {
  switch (status) {
    case 'Routed':
      return `Your request has been validated and routed to our ${assignedTeam}. A member of the team will follow up.`
    case 'Duplicate':
      return 'This looks similar to a recent request from your organization, so a coordinator will confirm before it goes any further. Nothing further is needed from you.'
    case 'In Review':
      return reasons.includes('Missing Required Data')
        ? 'Your request has been received. Some details could not be read from the attached document, so a coordinator will confirm them before routing.'
        : 'Your request has been received and is with a coordinator for review before routing.'
    case 'Exception':
      return 'Your request has been received and saved, but the attached document could not be processed automatically. Our operations team has been notified and will handle it manually.'
    default:
      return 'Your request has been received.'
  }
}
