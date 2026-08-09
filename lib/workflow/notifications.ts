/**
 * Submitter acknowledgement (FR-008, FR-031).
 *
 * The confirmation is produced as an *event* rather than being sent directly.
 * Two consequences worth having:
 *
 *  - The workflow is verifiable with no mail transport configured. A test can
 *    assert the acknowledgement was produced, addressed correctly, and carried
 *    the assigned team, without a mail server or a mock SMTP.
 *  - Adding a real transport later is a matter of consuming the event, not of
 *    changing the workflow.
 */

import type { AssignedTeam } from '../domain/enums'
import type { ConfirmationEvent } from '../domain/types'
import { nowIso } from '../utils/dates'

export interface ConfirmationInput {
  submissionId: string
  toEmail: string
  toName: string
  assignedTeam: AssignedTeam
  submissionType: string
  lineOfBusiness: string
  transport: string
  at?: string
}

export function buildConfirmation(input: ConfirmationInput): ConfirmationEvent {
  const subject = `We've received your ${input.submissionType.toLowerCase()} request — ${input.submissionId}`

  const body = [
    `Hello ${input.toName},`,
    '',
    `We've received your ${input.lineOfBusiness} ${input.submissionType.toLowerCase()} request and routed it to our ${input.assignedTeam}.`,
    '',
    `Your reference is ${input.submissionId}. Please quote it in any follow-up.`,
    '',
    'A member of the team will be in touch. No further action is needed from you right now.',
  ].join('\n')

  return {
    submissionId: input.submissionId,
    toEmail: input.toEmail,
    toName: input.toName,
    assignedTeam: input.assignedTeam,
    sentAt: input.at ?? nowIso(),
    transport: input.transport,
    subject,
    body,
  }
}

/**
 * Whether an acknowledgement should be sent for a given outcome.
 *
 * Only on successful routing. A submitter should not be told "we've routed
 * your request to the Auto Team" when the workflow failed and no team has it
 * yet (AC-011). Review and duplicate outcomes are also silent to the
 * submitter: a person is about to look at it, and telling the client their
 * request is "under review" invites a status-chasing call before anyone has
 * actually looked.
 */
export function shouldSendConfirmation(status: string): boolean {
  return status === 'Routed'
}
