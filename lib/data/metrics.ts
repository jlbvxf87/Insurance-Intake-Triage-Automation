/**
 * Operations metrics (FR-035, FR-036, FR-037).
 *
 * Pure functions over records the repository already returned. Computing them
 * here rather than in the React components keeps every count assertable in a
 * test — "the counters agree with the underlying records" (AC-017) is only
 * checkable if the counting is separable from the rendering.
 */

import type { AutomationLog, SubmissionDetail } from '../domain/types'
import type { LineOfBusiness, SubmissionStatus } from '../domain/enums'
import { isSameUtcDay, nowIso } from '../utils/dates'

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface QueueView {
  id: string
  label: string
  /** Longer description shown as the view's subtitle. */
  description: string
  matches: (detail: SubmissionDetail) => boolean
}

const byStatus = (status: SubmissionStatus) => (d: SubmissionDetail) =>
  d.submission.status === status

const byLineOfBusiness = (lob: LineOfBusiness) => (d: SubmissionDetail) =>
  d.submission.lineOfBusiness === lob && d.submission.status !== 'Closed'

export const QUEUE_VIEWS: QueueView[] = [
  {
    id: 'all',
    label: 'All open',
    description: 'Every submission that is not yet closed.',
    matches: (d) => d.submission.status !== 'Closed',
  },
  {
    id: 'new',
    label: 'New',
    description: 'Accepted but not yet processed.',
    matches: (d) => d.submission.status === 'New' || d.submission.status === 'Processing',
  },
  {
    id: 'needs-review',
    label: 'Needs review',
    description:
      'Low confidence, missing required data, unknown routing, or a policy type that contradicts the submitted line of business.',
    matches: byStatus('In Review'),
  },
  {
    id: 'duplicates',
    label: 'Duplicates',
    description:
      'Possible duplicates of a recent submission from the same client. Awaiting a human decision.',
    matches: byStatus('Duplicate'),
  },
  {
    id: 'exceptions',
    label: 'Exceptions',
    description: 'The workflow failed. The submission is preserved and needs an operator.',
    matches: byStatus('Exception'),
  },
  {
    id: 'commercial-auto',
    label: 'Commercial Auto',
    description: 'Open submissions routed to the Auto Team.',
    matches: byLineOfBusiness('Commercial Auto'),
  },
  {
    id: 'property',
    label: 'Property',
    description: 'Open submissions routed to the Property Team.',
    matches: byLineOfBusiness('Property'),
  },
  {
    id: 'liability',
    label: 'Liability',
    description: 'Open submissions routed to the Casualty Team.',
    matches: byLineOfBusiness('General Liability'),
  },
  {
    id: 'workers-comp',
    label: 'Workers Comp',
    description: 'Open submissions routed to the WC Team.',
    matches: byLineOfBusiness('Workers Compensation'),
  },
  {
    id: 'closed',
    label: 'Closed',
    description: 'Resolved. No further action.',
    matches: byStatus('Closed'),
  },
]

export function resolveView(id: string | undefined): QueueView {
  return QUEUE_VIEWS.find((v) => v.id === id) ?? QUEUE_VIEWS[0]
}

export function filterByView(
  details: SubmissionDetail[],
  view: QueueView,
): SubmissionDetail[] {
  return details.filter((d) => view.matches(d))
}

export function countByView(details: SubmissionDetail[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const view of QUEUE_VIEWS) {
    counts[view.id] = details.filter((d) => view.matches(d)).length
  }
  return counts
}

// ---------------------------------------------------------------------------
// KPI counters
// ---------------------------------------------------------------------------

export interface Kpis {
  submissionsToday: number
  needsReview: number
  exceptions: number
  routedToday: number
  /** Percentage of today's submissions routed without human involvement. */
  straightThroughRate: number | null
}

export function computeKpis(
  details: SubmissionDetail[],
  now: string = nowIso(),
): Kpis {
  const today = details.filter((d) => isSameUtcDay(d.submission.dateReceived, now))
  const routedToday = today.filter((d) => d.submission.status === 'Routed')

  return {
    submissionsToday: today.length,
    // Needs review spans both human-judgement queues; exceptions are counted
    // separately because they are a different kind of problem.
    needsReview: details.filter(
      (d) => d.submission.status === 'In Review' || d.submission.status === 'Duplicate',
    ).length,
    exceptions: details.filter((d) => d.submission.status === 'Exception').length,
    routedToday: routedToday.length,
    straightThroughRate:
      today.length > 0 ? Math.round((routedToday.length / today.length) * 100) : null,
  }
}

// ---------------------------------------------------------------------------
// Automation health
// ---------------------------------------------------------------------------

export interface AutomationHealth {
  succeeded: number
  needsReview: number
  failed: number
  total: number
  successRate: number | null
  /** Median run duration, in milliseconds. */
  medianDurationMs: number | null
  topErrors: Array<{ step: string; count: number; latestMessage: string }>
}

export function computeAutomationHealth(logs: AutomationLog[]): AutomationHealth {
  const succeeded = logs.filter((l) => l.status === 'Succeeded').length
  const needsReview = logs.filter((l) => l.status === 'Needs Review').length
  const failed = logs.filter((l) => l.status === 'Failed').length
  const total = logs.length

  const durations = logs
    .map((l) => l.durationMs)
    .filter((d): d is number => typeof d === 'number')
    .sort((a, b) => a - b)

  // Grouped by the failing step rather than the message: `stepFailed` is a
  // constrained choice, so it aggregates. Free-text messages vary per run and
  // would produce a list of one-offs.
  const byStep = new Map<string, { count: number; latestMessage: string }>()
  for (const log of logs) {
    if (log.status !== 'Failed' || !log.stepFailed) continue
    const existing = byStep.get(log.stepFailed)
    byStep.set(log.stepFailed, {
      count: (existing?.count ?? 0) + 1,
      latestMessage: existing?.latestMessage ?? log.errorMessage ?? 'No message recorded.',
    })
  }

  return {
    succeeded,
    needsReview,
    failed,
    total,
    // Escalations count as successful automation: the workflow did what it was
    // designed to do. Only genuine failures reduce this number (FR-037).
    successRate:
      total > 0 ? Math.round(((succeeded + needsReview) / total) * 100) : null,
    medianDurationMs:
      durations.length > 0 ? durations[Math.floor(durations.length / 2)] : null,
    topErrors: [...byStep.entries()]
      .map(([step, value]) => ({ step, ...value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }
}

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

export function countByLineOfBusiness(
  details: SubmissionDetail[],
): Array<{ lineOfBusiness: string; count: number }> {
  const counts = new Map<string, number>()
  for (const detail of details) {
    const key = detail.submission.lineOfBusiness
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([lineOfBusiness, count]) => ({ lineOfBusiness, count }))
    .sort((a, b) => b.count - a.count)
}

/** Oldest item currently sitting in a human queue — the ageing signal. */
export function oldestAwaitingHuman(
  details: SubmissionDetail[],
): SubmissionDetail | null {
  const waiting = details
    .filter((d) =>
      ['In Review', 'Duplicate', 'Exception'].includes(d.submission.status),
    )
    .sort((a, b) => a.submission.dateReceived.localeCompare(b.submission.dateReceived))
  return waiting[0] ?? null
}
