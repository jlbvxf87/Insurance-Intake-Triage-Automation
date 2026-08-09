import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Paperclip } from 'lucide-react'
import { StatusBadge, Tag } from '@/components/ui/badge'
import { Callout } from '@/components/ui/callout'
import { ExtractionPanel } from '@/components/ops/extraction-panel'
import { RunTrace } from '@/components/ops/run-trace'
import { ReviewActions } from '@/components/ops/review-actions'
import { getRepository } from '@/lib/data/store'
import { getConfig } from '@/lib/config'
import { formatDateTime } from '@/lib/utils/dates'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return { title: `${id} · Operations` }
}

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getRepository().getSubmissionDetail(id)
  if (!detail) notFound()

  const { submission, client, extraction, logs } = detail
  const config = getConfig()

  return (
    <main className="mx-auto w-full max-w-[1080px] px-6 py-10">
      <Link
        href="/ops"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to queue
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {submission.submissionId}
          </h1>
          <p className="mt-1.5 text-[var(--muted)]">
            {client.companyName} · {submission.submissionType} ·{' '}
            {submission.lineOfBusiness}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={submission.status} />
          <Tag>{submission.assignedTeam}</Tag>
        </div>
      </header>

      {submission.needsHumanReview && submission.reviewReasons.length > 0 && (
        <div className="mt-6">
          <Callout
            tone={submission.status === 'Exception' ? 'danger' : 'warning'}
            title={`Awaiting a decision · ${submission.reviewReasons.join(', ')}`}
          >
            {submission.duplicateReason ?? reasonNarrative(submission.reviewReasons)}
          </Callout>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Submission ------------------------------------------------ */}
          <section
            aria-labelledby="submission-heading"
            className="rounded-xl border border-[var(--border)] bg-white"
          >
            <h2
              id="submission-heading"
              className="border-b border-[var(--border)] px-5 py-3.5 text-sm font-semibold"
            >
              Submission
            </h2>
            <dl className="divide-y divide-[var(--border)]">
              <Row label="Received">{formatDateTime(submission.dateReceived)}</Row>
              <Row label="Source">{submission.source}</Row>
              <Row label="Confidence">
                {/* Null confidence has two distinct causes, and collapsing them
                    into one label would tell an operator a document was never
                    supplied when in fact extraction failed on one. */}
                {submission.confidenceScore !== null
                  ? `${Math.round(submission.confidenceScore * 100)}%`
                  : submission.originalDocument
                    ? 'Not established — extraction did not complete'
                    : 'No document supplied'}
              </Row>
              <Row label="Document">
                {submission.originalDocument ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-[var(--subtle)]" aria-hidden="true" />
                    {submission.originalDocument.fileName}
                    <span className="text-[var(--subtle)]">
                      ({Math.round(submission.originalDocument.sizeBytes / 1024)} KB)
                    </span>
                  </span>
                ) : (
                  'None'
                )}
              </Row>
              <Row label="Description">
                <span className="leading-relaxed">{submission.description}</span>
              </Row>
              {submission.duplicateOfSubmissionId && (
                <Row label="Possible duplicate of">
                  <Link
                    href={`/ops/${submission.duplicateOfSubmissionId}`}
                    className="font-mono text-[var(--accent)] hover:underline"
                  >
                    {submission.duplicateOfSubmissionId}
                  </Link>
                </Row>
              )}
            </dl>
          </section>

          {/* Extraction ------------------------------------------------- */}
          {extraction ? (
            <ExtractionPanel
              extraction={extraction}
              threshold={config.confidenceThreshold}
              submissionId={submission.submissionId}
              editable={submission.status !== 'Closed'}
            />
          ) : (
            <section className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-5 py-6">
              <h2 className="text-sm font-semibold">Extracted policy data</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                {submission.originalDocument
                  ? 'A document was supplied but extraction did not complete. See the run trace below.'
                  : 'No document was supplied, so extraction was skipped. This is a normal path, not an exception.'}
              </p>
            </section>
          )}

          {/* Runs -------------------------------------------------------- */}
          <section aria-labelledby="runs-heading">
            <h2 id="runs-heading" className="text-sm font-semibold">
              Workflow runs
            </h2>
            <p className="mt-1 text-[13px] text-[var(--subtle)]">
              Every attempt against this submission, most recent first.
            </p>
            <div className="mt-3 flex flex-col gap-4">
              {logs.map((log) => (
                <RunTrace key={log.logId} log={log} />
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar ------------------------------------------------------ */}
        <aside className="flex flex-col gap-6">
          <section
            aria-labelledby="client-heading"
            className="rounded-xl border border-[var(--border)] bg-white p-5"
          >
            <h2 id="client-heading" className="text-sm font-semibold">
              Client
            </h2>
            <dl className="mt-3 flex flex-col gap-2.5 text-[13px]">
              <div>
                <dt className="text-[var(--subtle)]">Reference</dt>
                <dd className="font-mono">{client.clientId}</dd>
              </div>
              <div>
                <dt className="text-[var(--subtle)]">Company</dt>
                <dd>{client.companyName}</dd>
              </div>
              <div>
                <dt className="text-[var(--subtle)]">Contact</dt>
                <dd>{client.clientName}</dd>
              </div>
              <div>
                <dt className="text-[var(--subtle)]">Email</dt>
                <dd className="break-all">{client.email}</dd>
              </div>
              <div>
                <dt className="text-[var(--subtle)]">Matched on</dt>
                <dd className="font-mono text-[12px] break-all text-[var(--muted)]">
                  {client.normalizedEmail}
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="actions-heading"
            className="rounded-xl border border-[var(--border)] bg-white p-5"
          >
            <h2 id="actions-heading" className="text-sm font-semibold">
              Review actions
            </h2>
            <div className="mt-4">
              <ReviewActions
                submissionId={submission.submissionId}
                status={submission.status}
              />
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-[13px] text-[var(--subtle)]">{label}</dt>
      <dd className="text-[13px]">{children}</dd>
    </div>
  )
}

function reasonNarrative(reasons: string[]): string {
  const parts: string[] = []
  if (reasons.includes('Low Confidence')) {
    parts.push(
      'Extraction confidence is below the configured threshold, so the values are retained but unverified.',
    )
  }
  if (reasons.includes('Missing Required Data')) {
    parts.push('A required field could not be read from the document.')
  }
  if (reasons.includes('Unknown Routing Rule')) {
    parts.push(
      'No routing rule matched this line of business. The submission went to General Intake so it keeps moving.',
    )
  }
  if (reasons.includes('Policy Type Mismatch')) {
    parts.push(
      'The policy type read from the document contradicts the submitted line of business. Routing was not changed.',
    )
  }
  if (reasons.includes('Extraction Failure')) {
    parts.push('The workflow failed before the submission could be routed.')
  }
  return parts.join(' ')
}
