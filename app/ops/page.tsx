import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { KpiCard } from '@/components/ops/kpi-card'
import { ViewTabs } from '@/components/ops/view-tabs'
import { SubmissionQueue } from '@/components/ops/submission-queue'
import { AutomationHealthPanel } from '@/components/ops/automation-health'
import { Callout } from '@/components/ui/callout'
import { getRepository } from '@/lib/data/store'
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
import { getConfig, toPublicConfig } from '@/lib/config'
import { formatAge } from '@/lib/utils/dates'

export const metadata: Metadata = {
  title: 'Operations · Insurance Intake & Triage',
  description:
    'Internal queue, automation health, and exception monitoring for the intake workflow.',
}

export const dynamic = 'force-dynamic'

export default async function OpsDashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view: viewParam } = await searchParams
  const repository = getRepository()
  const config = toPublicConfig(getConfig())

  const details = await repository.listSubmissionDetails()
  const logs = await repository.listLogs()

  const view = resolveView(viewParam)
  const rows = filterByView(details, view)
  const counts = countByView(details)
  const kpis = computeKpis(details)
  const health = computeAutomationHealth(logs)
  const distribution = countByLineOfBusiness(details.filter((d) => d.submission.status !== 'Closed'))
  const oldest = oldestAwaitingHuman(details)

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to case study
      </Link>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-widest text-[var(--subtle)] uppercase">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Submission queue
          </h1>
        </div>
        <Link
          href="/intake"
          className="text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Submit a test request →
        </Link>
      </header>

      {config.isDemoMode && (
        <div className="mt-6">
          <Callout tone="info" title="Demo mode">
            Synthetic records, seeded on server start. Document extraction uses
            local fixtures rather than Azure AI Document Intelligence. Running
            locally, submissions made through the intake form appear here
            immediately. On the hosted demo the store is per serverless
            instance, so a submission may land on an instance other than the one
            serving this page — a property of the in-memory store, not of the
            workflow.
          </Callout>
        </div>
      )}

      {/* KPIs (FR-036) */}
      <section aria-label="Key figures" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Submissions today"
          value={kpis.submissionsToday}
          hint={
            kpis.straightThroughRate === null
              ? 'No submissions yet today'
              : `${kpis.straightThroughRate}% routed without human involvement`
          }
        />
        <KpiCard
          label="Needs review"
          value={kpis.needsReview}
          tone={kpis.needsReview > 0 ? 'warn' : 'neutral'}
          hint="Low confidence, missing data, or possible duplicates"
        />
        <KpiCard
          label="Exceptions"
          value={kpis.exceptions}
          tone={kpis.exceptions > 0 ? 'danger' : 'neutral'}
          hint="Workflow failures awaiting an operator"
        />
        <KpiCard
          label="Routed today"
          value={kpis.routedToday}
          tone={kpis.routedToday > 0 ? 'ok' : 'neutral'}
          hint="Assigned to a team and acknowledged"
        />
      </section>

      {oldest && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-[var(--muted)]">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Oldest item awaiting a person:{' '}
          <Link
            href={`/ops/${oldest.submission.submissionId}`}
            className="font-mono font-medium text-[var(--accent)] hover:underline"
          >
            {oldest.submission.submissionId}
          </Link>
          <span className="text-[var(--subtle)]">
            · {formatAge(oldest.submission.dateReceived)} · {oldest.submission.status}
          </span>
        </p>
      )}

      {/* Views span the full width — at ten of them, sharing a column with the
          health panel truncates the last few behind a scroll an operator has no
          reason to expect. */}
      <div className="mt-8">
        <ViewTabs views={QUEUE_VIEWS} activeId={view.id} counts={counts} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Queue (FR-035) */}
        <div className="min-w-0">
          <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted)]">
            {view.description}
          </p>

          <div className="mt-4">
            <SubmissionQueue
              details={rows}
              emptyMessage={`Nothing in ${view.label.toLowerCase()} right now.`}
            />
          </div>
        </div>

        {/* Health (FR-037) */}
        <aside className="flex flex-col gap-5">
          <AutomationHealthPanel health={health} />

          <section
            aria-labelledby="distribution-heading"
            className="rounded-xl border border-[var(--border)] bg-white p-5"
          >
            <h2 id="distribution-heading" className="text-sm font-semibold">
              Open by line of business
            </h2>
            {distribution.length === 0 ? (
              <p className="mt-2 text-[13px] text-[var(--subtle)]">
                No open submissions.
              </p>
            ) : (
              <dl className="mt-3 flex flex-col gap-2.5">
                {distribution.map((entry) => (
                  <div key={entry.lineOfBusiness} className="text-[13px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt>{entry.lineOfBusiness}</dt>
                      <dd className="tabular-nums text-[var(--muted)]">{entry.count}</dd>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface)]">
                      <div
                        className="h-full bg-[var(--foreground)]"
                        style={{
                          width: `${(entry.count / distribution[0].count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}
