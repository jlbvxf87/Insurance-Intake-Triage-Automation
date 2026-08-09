/**
 * Duplicate detection (FR-004, BR-013 – BR-016).
 *
 * A submission is a *possible* duplicate when all four hold:
 *   1. the client matches (already resolved by normalized email),
 *   2. the submission type matches,
 *   3. the line of business matches,
 *   4. the earlier submission falls inside the configured window.
 *
 * "Possible" is the operative word. The rule flags and escalates; it never
 * rejects, closes, or merges (BR-016). Under-flagging costs a person a few
 * seconds of review; over-flagging that auto-rejected real business would cost
 * considerably more.
 */

import type { Submission } from '../domain/types'
import { isWithinDays, wholeDaysBetween } from '../utils/dates'

export interface DuplicateCheckInput {
  candidates: Submission[]
  submissionType: Submission['submissionType']
  lineOfBusiness: Submission['lineOfBusiness']
  /** Receipt time of the submission being evaluated. */
  now: string
  windowDays: number
  /** Excluded from its own comparison when re-running against a stored record. */
  excludeSubmissionId?: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason: string | null
  duplicateOfSubmissionId: string | null
  /** The window used, echoed back so the log records the value in force. */
  windowDays: number
}

/**
 * Statuses that disqualify a prior submission from being duplicate evidence.
 *
 * `Exception` means the earlier run failed — a failed run is not evidence that
 * a valid submission already exists, and treating it as such would trap a
 * client in review after a service outage (BR-015).
 */
const NON_EVIDENCE_STATUSES = new Set<Submission['status']>(['Exception'])

export function checkForDuplicate(input: DuplicateCheckInput): DuplicateCheckResult {
  const {
    candidates,
    submissionType,
    lineOfBusiness,
    now,
    windowDays,
    excludeSubmissionId,
  } = input

  const match = candidates
    .filter((candidate) => candidate.submissionId !== excludeSubmissionId)
    .filter((candidate) => candidate.submissionType === submissionType)
    .filter((candidate) => candidate.lineOfBusiness === lineOfBusiness)
    .filter((candidate) => !NON_EVIDENCE_STATUSES.has(candidate.status))
    .filter((candidate) => isWithinDays(candidate.dateReceived, now, windowDays))
    // Most recent first: the nearest prior submission is the most useful
    // comparison for whoever reviews the flag.
    .sort((a, b) => b.dateReceived.localeCompare(a.dateReceived))[0]

  if (!match) {
    return {
      isDuplicate: false,
      reason: null,
      duplicateOfSubmissionId: null,
      windowDays,
    }
  }

  const elapsed = wholeDaysBetween(match.dateReceived, now)
  const elapsedText =
    elapsed === 0 ? 'earlier today' : elapsed === 1 ? '1 day ago' : `${elapsed} days ago`

  return {
    isDuplicate: true,
    duplicateOfSubmissionId: match.submissionId,
    windowDays,
    // Written for a human reviewer: every condition that fired, plus the
    // window in force, so the flag can be judged without opening the rule.
    reason:
      `Same client, same submission type (${submissionType}), same line of business ` +
      `(${lineOfBusiness}). Previous submission ${match.submissionId} was received ` +
      `${elapsedText} (window: ${windowDays} days).`,
  }
}
