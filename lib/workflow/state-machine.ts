/**
 * Submission state machine (FR-010, FR-011, docs/future-state.md §6).
 *
 * The status field is the operational contract between the automation and the
 * people working the queues, so the transitions are declared as data and
 * checked rather than left to whichever code path happens to write next.
 *
 * The rule this enforces: an operator action can only move a submission
 * somewhere the design says it can go. Without it, a bug in a review handler
 * could quietly move an Exception straight to Closed and the audit trail would
 * show a transition that was never meant to exist.
 */

import type { SubmissionStatus } from '../domain/enums'

export const ALLOWED_TRANSITIONS: Readonly<
  Record<SubmissionStatus, readonly SubmissionStatus[]>
> = {
  New: ['Processing', 'Exception'],
  Processing: ['Routed', 'In Review', 'Duplicate', 'Exception'],
  // A routed submission can come back for review if a team disputes the
  // assignment, and closes when the work is done.
  Routed: ['In Review', 'Closed'],
  // A reviewer either releases it to a team, confirms it as a duplicate, or
  // closes it.
  'In Review': ['Routed', 'Duplicate', 'Closed'],
  // A duplicate is either confirmed (closed) or dismissed (routed on).
  Duplicate: ['Routed', 'In Review', 'Closed'],
  // An exception is retried — which re-enters Processing — or closed manually.
  Exception: ['Processing', 'In Review', 'Routed', 'Closed'],
  // Terminal. Reopening creates a new submission rather than resurrecting a
  // closed one, so the history of what was decided stays intact.
  Closed: [],
}

export function canTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: SubmissionStatus,
    readonly to: SubmissionStatus,
  ) {
    super(
      `Cannot move a submission from "${from}" to "${to}". Allowed from "${from}": ` +
        (ALLOWED_TRANSITIONS[from].length
          ? ALLOWED_TRANSITIONS[from].map((s) => `"${s}"`).join(', ')
          : 'none — this is a terminal state'),
    )
    this.name = 'InvalidTransitionError'
  }
}

export function assertTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

/** Statuses that sit in a human queue rather than with an automated process. */
export const HUMAN_QUEUE_STATUSES: readonly SubmissionStatus[] = [
  'In Review',
  'Duplicate',
  'Exception',
]

export function isAwaitingHuman(status: SubmissionStatus): boolean {
  return HUMAN_QUEUE_STATUSES.includes(status)
}

/** Terminal states — no automated process will touch these again. */
export function isTerminal(status: SubmissionStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0
}
