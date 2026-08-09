/**
 * Human review actions (FR-010, FR-011).
 *
 * The counterpart to the automated workflow. Where the orchestrator escalates,
 * this is what a person does next — and every action is logged the same way an
 * automated run is, so the audit trail does not go quiet the moment a human
 * takes over.
 *
 * Each action is validated against the state machine, so a review handler
 * cannot move a submission somewhere the design does not allow.
 */

import type { Repository } from '../data/repository'
import type { AutomationLog, Submission } from '../domain/types'
import type { SubmissionStatus } from '../domain/enums'
import { assertTransition } from './state-machine'
import { resolveTeam } from './business-rules'
import { newLogId, newRunId } from '../utils/ids'
import { nowIso } from '../utils/dates'
import { WORKFLOW_NAME } from './run-logger'
import { buildConfirmation, type ConfirmationInput } from './notifications'
import type { ConfirmationEvent } from '../domain/types'

export type ReviewAction =
  /** Reviewer accepted the submission — release it to its team. */
  | { type: 'release'; note?: string }
  /** Reviewer confirmed the duplicate — close it. */
  | { type: 'confirm-duplicate'; note?: string }
  /** Reviewer decided it is not a duplicate — clear the flag and release. */
  | { type: 'dismiss-duplicate'; note?: string }
  /** Reviewer corrected extracted values (FR-011). */
  | {
      type: 'correct-extraction'
      corrections: Partial<{
        carrier: string
        policyNumber: string
        namedInsured: string
        effectiveDate: string
        expirationDate: string
        coverageAmount: number
      }>
      note?: string
    }
  /** Operator closed the submission without routing. */
  | { type: 'close'; note?: string }

export interface ReviewResult {
  submission: Submission
  log: AutomationLog
  confirmation: ConfirmationEvent | null
}

export interface ReviewOptions {
  submissionId: string
  action: ReviewAction
  repository: Repository
  /** Identifier of the person acting. Recorded on the log entry. */
  actor: string
  notificationTransport?: string
  now?: string
}

export async function applyReviewAction(
  options: ReviewOptions,
): Promise<ReviewResult> {
  const { submissionId, action, repository, actor } = options
  const now = options.now ?? nowIso()
  const startedMs = Date.now()

  const submission = await repository.getSubmission(submissionId)
  if (!submission) {
    throw new Error(`Submission ${submissionId} not found.`)
  }

  let patch: Partial<Submission> = {}
  let detail = ''
  let confirmation: ConfirmationEvent | null = null

  switch (action.type) {
    case 'release':
    case 'dismiss-duplicate': {
      const routing = resolveTeam(submission.lineOfBusiness)
      const target: SubmissionStatus = 'Routed'
      assertTransition(submission.status, target)

      patch = {
        status: target,
        assignedTeam: routing.team,
        needsHumanReview: false,
        reviewReasons: [],
        ...(action.type === 'dismiss-duplicate'
          ? { duplicateFlag: false, duplicateReason: null, duplicateOfSubmissionId: null }
          : {}),
      }
      detail =
        action.type === 'dismiss-duplicate'
          ? `Duplicate flag dismissed by ${actor}. Released to ${routing.team}.`
          : `Released by ${actor} to ${routing.team} after review.`

      const client = await repository.getClient(submission.clientId)
      if (client) {
        confirmation = buildConfirmation({
          submissionId,
          toEmail: client.email,
          toName: client.clientName,
          assignedTeam: routing.team,
          submissionType: submission.submissionType,
          lineOfBusiness: submission.lineOfBusiness,
          transport: options.notificationTransport ?? 'log',
          at: now,
        } satisfies ConfirmationInput)
      }
      break
    }

    case 'confirm-duplicate': {
      assertTransition(submission.status, 'Closed')
      patch = { status: 'Closed', needsHumanReview: false }
      detail = `Confirmed as a duplicate by ${actor}${
        submission.duplicateOfSubmissionId
          ? ` of ${submission.duplicateOfSubmissionId}`
          : ''
      }. Closed without routing.`
      break
    }

    case 'correct-extraction': {
      const extraction = await repository.getExtractionBySubmission(submissionId)
      if (!extraction) {
        throw new Error(`No extraction record exists for ${submissionId}.`)
      }

      const applied = Object.entries(action.corrections).filter(
        ([, value]) => value !== undefined && value !== '',
      )

      await repository.updateExtraction(extraction.extractionId, {
        ...Object.fromEntries(applied),
        // A human-confirmed value is verified by definition. Confidence stays
        // as extracted — it records what the model reported, and overwriting it
        // would erase the evidence that the model struggled with this document.
        validationStatus: 'Validated',
        missingFields: [],
      })

      detail = `Extracted values corrected by ${actor}: ${
        applied.map(([field]) => field).join(', ') || 'no changes'
      }. Validation status set to Validated.`
      // Status is unchanged — correcting the data does not by itself release
      // the submission. The reviewer releases it as a separate, deliberate act.
      break
    }

    case 'close': {
      assertTransition(submission.status, 'Closed')
      patch = { status: 'Closed', needsHumanReview: false }
      detail = `Closed by ${actor} without routing.`
      break
    }
  }

  if (action.note) detail += ` Note: ${action.note}`

  const updated =
    Object.keys(patch).length > 0
      ? await repository.updateSubmission(submissionId, patch)
      : submission

  const completedMs = Date.now()
  const log: AutomationLog = {
    logId: newLogId(),
    submissionId,
    workflowName: `${WORKFLOW_NAME} — Human Review`,
    runId: newRunId(),
    started: now,
    completed: new Date(completedMs).toISOString(),
    status: 'Succeeded',
    stepFailed: null,
    errorMessage: null,
    retryCount: 0,
    durationMs: completedMs - startedMs,
    steps: [
      {
        step: 'Apply Business Rules',
        outcome: 'ok',
        detail,
        at: now,
        durationMs: completedMs - startedMs,
      },
    ],
  }

  await repository.createLog(log)

  return { submission: updated, log, confirmation }
}
