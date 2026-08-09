import { cn } from '@/lib/utils/cn'
import type { AutomationHealth } from '@/lib/data/metrics'

/**
 * Automation health panel (FR-037).
 *
 * The bar is a proportion, and every segment is also given as a labelled
 * number below it — the visual is a summary, not the only way to read the data
 * (NFR-011).
 */
export function AutomationHealthPanel({ health }: { health: AutomationHealth }) {
  const segments = [
    { label: 'Succeeded', value: health.succeeded, className: 'bg-[var(--ok)]' },
    { label: 'Needs review', value: health.needsReview, className: 'bg-[var(--warn)]' },
    { label: 'Failed', value: health.failed, className: 'bg-[var(--danger)]' },
  ]

  return (
    <section
      aria-labelledby="automation-health-heading"
      className="rounded-xl border border-[var(--border)] bg-white p-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="automation-health-heading" className="text-sm font-semibold">
          Automation health
        </h2>
        <span className="text-[13px] text-[var(--subtle)]">
          {health.total} run{health.total === 1 ? '' : 's'}
        </span>
      </div>

      <p className="mt-1 text-[12px] leading-snug text-[var(--subtle)]">
        A correct escalation counts as a successful run — the workflow did what
        it was designed to do.
      </p>

      {health.total > 0 && (
        <div
          className="mt-4 flex h-2 overflow-hidden rounded-full bg-[var(--surface)]"
          role="img"
          aria-label={`${health.succeeded} succeeded, ${health.needsReview} needs review, ${health.failed} failed`}
        >
          {segments.map(
            (segment) =>
              segment.value > 0 && (
                <div
                  key={segment.label}
                  className={cn('h-full', segment.className)}
                  style={{ width: `${(segment.value / health.total) * 100}%` }}
                />
              ),
          )}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {segments.map((segment) => (
          <div key={segment.label}>
            <dt className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
              <span
                className={cn('h-2 w-2 rounded-full', segment.className)}
                aria-hidden="true"
              />
              {segment.label}
            </dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{segment.value}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--border)] pt-4 text-[13px]">
        <div>
          <dt className="text-[var(--subtle)]">Completed without failure</dt>
          <dd className="font-medium tabular-nums">
            {health.successRate === null ? '—' : `${health.successRate}%`}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--subtle)]">Median run time</dt>
          <dd className="font-medium tabular-nums">
            {health.medianDurationMs === null
              ? '—'
              : `${(health.medianDurationMs / 1000).toFixed(1)}s`}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <h3 className="text-[13px] font-semibold">Top errors</h3>
        {health.topErrors.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--subtle)]">
            No failed runs in this period.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2.5">
            {health.topErrors.map((error) => (
              <li key={error.step} className="text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{error.step}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {error.count}×
                  </span>
                </div>
                <p className="mt-0.5 leading-snug text-[var(--subtle)]">
                  {error.latestMessage}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
