'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock, Copy, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import type { SubmissionResponse } from '@/lib/domain/schemas'
import type { SubmissionStatus } from '@/lib/domain/enums'

/**
 * Post-submission receipt (FR-016).
 *
 * Tells the submitter what actually happened rather than a generic "thank
 * you". If the request went to human review, it says so — hiding that would
 * set the wrong expectation about turnaround.
 */

export function SubmissionReceipt({
  result,
  onSubmitAnother,
}: {
  result: SubmissionResponse
  onSubmitAnother: () => void
}) {
  const [copied, setCopied] = useState(false)
  const status = result.status as SubmissionStatus
  const routed = status === 'Routed'
  const exception = status === 'Exception'

  const Icon = routed ? CheckCircle2 : exception ? TriangleAlert : Clock
  const iconTone = routed
    ? 'text-[var(--ok)]'
    : exception
      ? 'text-[var(--danger)]'
      : 'text-[var(--warn)]'

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(result.submissionId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied; the reference is visible on screen
      // either way, so there is nothing to recover from.
    }
  }

  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <div className="flex items-start gap-4">
        <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${iconTone}`} aria-hidden="true" />
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {routed
              ? 'Request received and routed'
              : exception
                ? 'Request received — processing issue'
                : 'Request received — under review'}
          </h2>
          <p className="mt-2 leading-relaxed text-[var(--muted)]">{result.message}</p>
        </div>
      </div>

      <dl className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
        <Row label="Reference">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{result.submissionId}</span>
            <button
              type="button"
              onClick={copyReference}
              className="rounded-md p-1 text-[var(--subtle)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Copy reference</span>
            </button>
            <span aria-live="polite" className="text-[13px] text-[var(--ok)]">
              {copied ? 'Copied' : ''}
            </span>
          </div>
        </Row>

        <Row label="Status">
          <StatusBadge status={status} />
        </Row>

        <Row label="Assigned team">
          <span className="text-sm">{result.assignedTeam}</span>
        </Row>

        {result.confidenceScore !== null && (
          <Row label="Extraction confidence">
            <span className="font-mono text-sm">
              {Math.round(result.confidenceScore * 100)}%
            </span>
          </Row>
        )}

        {result.extractionProvider && (
          <Row label="Extraction source">
            <span className="text-sm">
              {result.extractionProvider === 'azure'
                ? 'Azure AI Document Intelligence'
                : 'Local fixture (demo mode)'}
            </span>
          </Row>
        )}

        {result.reviewReasons.length > 0 && (
          <Row label="Flagged for review">
            <ul className="flex flex-col gap-1 text-sm">
              {result.reviewReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Row>
        )}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onSubmitAnother} variant="secondary">
          Submit another request
        </Button>
        <Link
          href="/ops"
          className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-[var(--accent)] hover:underline"
        >
          See it in the operations dashboard
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-4">
      <dt className="text-[13px] font-medium text-[var(--subtle)]">{label}</dt>
      <dd className="text-[var(--foreground)]">{children}</dd>
    </div>
  )
}
