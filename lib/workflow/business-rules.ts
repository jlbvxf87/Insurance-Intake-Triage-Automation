/**
 * Deterministic business rules (FR-007, FR-028, FR-029, BR-001 – BR-006, BR-020).
 *
 * Pure functions over plain data. No I/O, no clock, no configuration lookup —
 * everything they need is passed in. That is what makes routing testable in
 * isolation and what makes "identical inputs always produce identical output"
 * a property rather than an aspiration (NFR-014).
 *
 * The AI's opinion never appears in the routing decision. An extracted
 * `policyType` that disagrees with the submitted line of business is recorded
 * as a review reason — it does not change the assignment (FR-030).
 */

import type {
  AssignedTeam,
  LineOfBusiness,
  PolicyType,
  ReviewReason,
  SubmissionStatus,
} from '../domain/enums'

/**
 * The routing table (BR-001 – BR-005).
 *
 * Expressed as data rather than a switch statement: an operations lead can
 * read it, and adding a line of business is a one-line change with no control
 * flow to reason about.
 */
export const ROUTING_RULES: Readonly<Record<LineOfBusiness, AssignedTeam>> = {
  'Commercial Auto': 'Auto Team',
  Property: 'Property Team',
  'General Liability': 'Casualty Team',
  'Workers Compensation': 'WC Team',
  Other: 'General Intake',
}

/** Fallback when the line of business is not in the table (BR-006). */
export const UNKNOWN_ROUTING_TEAM: AssignedTeam = 'General Intake'

export interface RoutingDecision {
  team: AssignedTeam
  /** False when the fallback was used — the caller must flag for review. */
  matched: boolean
}

/**
 * Resolve the owning team.
 *
 * An unrecognized line of business is neither an error nor a silent default:
 * the submission routes to General Intake so it keeps moving, and `matched`
 * is false so the caller flags the rules-table gap for a human (AC-009).
 */
export function resolveTeam(lineOfBusiness: string): RoutingDecision {
  const team = ROUTING_RULES[lineOfBusiness as LineOfBusiness]
  return team ? { team, matched: true } : { team: UNKNOWN_ROUTING_TEAM, matched: false }
}

/** Which lines of business a given extracted policy type is consistent with. */
const POLICY_TYPE_TO_LOB: Readonly<Record<PolicyType, LineOfBusiness | null>> = {
  'Commercial Auto': 'Commercial Auto',
  'Commercial Property': 'Property',
  'General Liability': 'General Liability',
  'Workers Compensation': 'Workers Compensation',
  Umbrella: null,
  Unknown: null,
}

/**
 * Does the extracted policy type contradict the submitted line of business?
 *
 * A mismatch is *information*, not a decision. It is surfaced to a reviewer
 * because the submitter may have chosen the wrong option — or the extraction
 * may be wrong. Deciding which is exactly the judgement call a person should
 * be making (FR-030).
 */
export function detectPolicyTypeMismatch(
  lineOfBusiness: LineOfBusiness,
  policyType: PolicyType | null,
): boolean {
  if (!policyType) return false
  const implied = POLICY_TYPE_TO_LOB[policyType]
  if (implied === null) return false
  return implied !== lineOfBusiness
}

// ---------------------------------------------------------------------------
// Outcome resolution
// ---------------------------------------------------------------------------

export interface OutcomeInput {
  /** A workflow step failed — extraction, or a write (BR-009, BR-011). */
  hasWorkflowError: boolean
  /** A prior submission satisfies the duplicate rule (BR-008). */
  isPossibleDuplicate: boolean
  /** Extraction confidence below the threshold (BR-007). */
  isLowConfidence: boolean
  /** A required extracted field is absent (BR-010). */
  hasMissingRequiredData: boolean
  /** No routing rule matched the line of business (BR-006). */
  hasUnknownRouting: boolean
  /** Extracted policy type contradicts the submitted line of business. */
  hasPolicyTypeMismatch: boolean
}

export interface Outcome {
  status: SubmissionStatus
  needsHumanReview: boolean
  /** Every applicable reason, not only the one that decided the status. */
  reviewReasons: ReviewReason[]
}

/**
 * Resolve the final status from all applicable conditions (BR-020).
 *
 * Precedence: Exception > Duplicate > In Review > Routed.
 *
 * The precedence order decides the *status*; it does not discard the other
 * reasons. A submission that is both a possible duplicate and low-confidence
 * shows as `Duplicate` and carries both reasons, because a reviewer needs to
 * know about the confidence problem even while they are adjudicating the
 * duplicate (AC-015).
 */
export function resolveOutcome(input: OutcomeInput): Outcome {
  const reasons: ReviewReason[] = []

  if (input.hasWorkflowError) reasons.push('Extraction Failure')
  if (input.isPossibleDuplicate) reasons.push('Possible Duplicate')
  if (input.isLowConfidence) reasons.push('Low Confidence')
  if (input.hasMissingRequiredData) reasons.push('Missing Required Data')
  if (input.hasUnknownRouting) reasons.push('Unknown Routing Rule')
  if (input.hasPolicyTypeMismatch) reasons.push('Policy Type Mismatch')

  if (input.hasWorkflowError) {
    return { status: 'Exception', needsHumanReview: true, reviewReasons: reasons }
  }

  if (input.isPossibleDuplicate) {
    return { status: 'Duplicate', needsHumanReview: true, reviewReasons: reasons }
  }

  if (
    input.isLowConfidence ||
    input.hasMissingRequiredData ||
    input.hasUnknownRouting ||
    input.hasPolicyTypeMismatch
  ) {
    return { status: 'In Review', needsHumanReview: true, reviewReasons: reasons }
  }

  return { status: 'Routed', needsHumanReview: false, reviewReasons: [] }
}

/**
 * Confidence gate (BR-007, BR-017).
 *
 * Inclusive at the boundary: confidence exactly equal to the threshold is
 * accepted. Stated explicitly because "below the threshold" is ambiguous in
 * prose and the boundary is directly tested (TC-06b).
 */
export function isBelowConfidenceThreshold(
  confidence: number,
  threshold: number,
): boolean {
  return confidence < threshold
}
