import { describe, it, expect, beforeEach } from 'vitest'
import {
  QUEUE_VIEWS,
  computeAutomationHealth,
  computeKpis,
  countByLineOfBusiness,
  countByView,
  filterByView,
  oldestAwaitingHuman,
  resolveView,
} from '@/lib/data/metrics'
import type { InMemoryRepository } from '@/lib/data/memory-repository'
import type { SubmissionDetail } from '@/lib/domain/types'
import { isSameUtcDay } from '@/lib/utils/dates'
import { NOW, freshRepository } from './helpers'

let repository: InMemoryRepository
let details: SubmissionDetail[]

beforeEach(async () => {
  repository = freshRepository()
  details = await repository.listSubmissionDetails()
})

describe('queue views (FR-035)', () => {
  it('provides every view the requirements name', () => {
    const ids = QUEUE_VIEWS.map((v) => v.id)
    for (const required of [
      'new',
      'needs-review',
      'duplicates',
      'exceptions',
      'commercial-auto',
      'property',
      'liability',
      'workers-comp',
      'closed',
    ]) {
      expect(ids).toContain(required)
    }
  })

  it('falls back to the default view for an unknown id', () => {
    expect(resolveView('nonsense').id).toBe('all')
    expect(resolveView(undefined).id).toBe('all')
  })

  it('filters each status view to exactly that status', () => {
    const cases = [
      ['needs-review', 'In Review'],
      ['duplicates', 'Duplicate'],
      ['exceptions', 'Exception'],
      ['closed', 'Closed'],
    ] as const

    for (const [viewId, status] of cases) {
      const rows = filterByView(details, resolveView(viewId))
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) expect(row.submission.status).toBe(status)
    }
  })

  it('excludes closed submissions from the line-of-business views', () => {
    const rows = filterByView(details, resolveView('commercial-auto'))
    for (const row of rows) {
      expect(row.submission.lineOfBusiness).toBe('Commercial Auto')
      expect(row.submission.status).not.toBe('Closed')
    }
  })

  it('produces a count for every view that agrees with the filter (AC-017)', () => {
    const counts = countByView(details)
    for (const view of QUEUE_VIEWS) {
      expect(counts[view.id]).toBe(filterByView(details, view).length)
    }
  })

  it('accounts for every submission across the open and closed views', () => {
    const open = filterByView(details, resolveView('all')).length
    const closed = filterByView(details, resolveView('closed')).length
    expect(open + closed).toBe(details.length)
  })
})

describe('KPI counters (FR-036)', () => {
  it('counts today’s submissions against the underlying records', () => {
    const kpis = computeKpis(details, NOW)
    const expected = details.filter((d) =>
      isSameUtcDay(d.submission.dateReceived, NOW),
    ).length
    expect(kpis.submissionsToday).toBe(expected)
  })

  it('counts needs-review as In Review plus Duplicate', () => {
    const kpis = computeKpis(details, NOW)
    const expected = details.filter(
      (d) => d.submission.status === 'In Review' || d.submission.status === 'Duplicate',
    ).length
    expect(kpis.needsReview).toBe(expected)
  })

  it('counts exceptions separately from review', () => {
    const kpis = computeKpis(details, NOW)
    expect(kpis.exceptions).toBe(
      details.filter((d) => d.submission.status === 'Exception').length,
    )
  })

  it('reports the straight-through rate as a whole percentage', () => {
    const kpis = computeKpis(details, NOW)
    expect(kpis.straightThroughRate).not.toBeNull()
    expect(kpis.straightThroughRate).toBeGreaterThanOrEqual(0)
    expect(kpis.straightThroughRate).toBeLessThanOrEqual(100)
    expect(Number.isInteger(kpis.straightThroughRate)).toBe(true)
  })

  it('returns null rather than dividing by zero on an empty day', () => {
    const kpis = computeKpis([], NOW)
    expect(kpis.straightThroughRate).toBeNull()
    expect(kpis.submissionsToday).toBe(0)
  })
})

describe('automation health (FR-037)', () => {
  it('classifies every log into exactly one bucket', async () => {
    const logs = await repository.listLogs()
    const health = computeAutomationHealth(logs)
    expect(health.succeeded + health.needsReview + health.failed).toBe(health.total)
    expect(health.total).toBe(logs.length)
  })

  it('counts an escalation toward the success rate, not against it', async () => {
    const logs = await repository.listLogs()
    const health = computeAutomationHealth(logs)
    const expected = Math.round(
      ((health.succeeded + health.needsReview) / health.total) * 100,
    )
    expect(health.successRate).toBe(expected)
    expect(health.needsReview).toBeGreaterThan(0) // the seed contains escalations
  })

  it('groups top errors by failing step, most frequent first', async () => {
    const logs = await repository.listLogs()
    const health = computeAutomationHealth(logs)
    expect(health.topErrors.length).toBeGreaterThan(0)
    for (let i = 1; i < health.topErrors.length; i += 1) {
      expect(health.topErrors[i - 1].count).toBeGreaterThanOrEqual(
        health.topErrors[i].count,
      )
    }
    expect(health.topErrors.every((e) => e.latestMessage.length > 0)).toBe(true)
  })

  it('counts each failing step exactly once per failed run', async () => {
    const logs = await repository.listLogs()
    const health = computeAutomationHealth(logs)
    const total = health.topErrors.reduce((sum, e) => sum + e.count, 0)
    expect(total).toBe(health.failed)
  })

  it('handles an empty log set without dividing by zero', () => {
    const health = computeAutomationHealth([])
    expect(health.successRate).toBeNull()
    expect(health.medianDurationMs).toBeNull()
    expect(health.topErrors).toEqual([])
  })
})

describe('distribution and ageing', () => {
  it('counts open submissions by line of business, descending', () => {
    const open = details.filter((d) => d.submission.status !== 'Closed')
    const distribution = countByLineOfBusiness(open)
    expect(distribution.reduce((sum, e) => sum + e.count, 0)).toBe(open.length)
    for (let i = 1; i < distribution.length; i += 1) {
      expect(distribution[i - 1].count).toBeGreaterThanOrEqual(distribution[i].count)
    }
  })

  it('surfaces the oldest item awaiting a person', () => {
    const oldest = oldestAwaitingHuman(details)
    expect(oldest).not.toBeNull()
    expect(['In Review', 'Duplicate', 'Exception']).toContain(
      oldest!.submission.status,
    )

    const waiting = details.filter((d) =>
      ['In Review', 'Duplicate', 'Exception'].includes(d.submission.status),
    )
    for (const item of waiting) {
      expect(
        oldest!.submission.dateReceived <= item.submission.dateReceived,
      ).toBe(true)
    }
  })

  it('returns null when nothing is waiting on a person', () => {
    const routedOnly = details.filter((d) => d.submission.status === 'Routed')
    expect(oldestAwaitingHuman(routedOnly)).toBeNull()
  })
})
