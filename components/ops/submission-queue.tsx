import Link from 'next/link'
import { AlertTriangle, FileText, Paperclip } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { formatAge, formatDate } from '@/lib/utils/dates'
import type { SubmissionDetail } from '@/lib/domain/types'

/**
 * Submission queue (FR-035).
 *
 * A real `<table>` with a caption and scoped headers — this is tabular data,
 * and a grid of divs would make it unreadable with a screen reader. Below the
 * `md` breakpoint it becomes a card list, because a seven-column table on a
 * phone is worse than no table at all (NFR-013).
 */
export function SubmissionQueue({
  details,
  emptyMessage,
}: {
  details: SubmissionDetail[]
  emptyMessage: string
}) {
  if (details.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-12 text-center">
        <FileText className="mx-auto h-5 w-5 text-[var(--subtle)]" aria-hidden="true" />
        <p className="mt-3 text-sm text-[var(--muted)]">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Submission queue. {details.length} submission
            {details.length === 1 ? '' : 's'}.
          </caption>
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left">
              <Th>Reference</Th>
              <Th>Client</Th>
              <Th>Type</Th>
              <Th>Line of business</Th>
              <Th>Status</Th>
              <Th>Assigned team</Th>
              <Th className="text-right">Received</Th>
            </tr>
          </thead>
          <tbody>
            {details.map(({ submission, client }) => (
              <tr
                key={submission.submissionId}
                className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)]"
              >
                <Td>
                  <Link
                    href={`/ops/${submission.submissionId}`}
                    className="font-mono text-[13px] font-medium text-[var(--accent)] hover:underline"
                  >
                    {submission.submissionId}
                  </Link>
                  {submission.originalDocument && (
                    <Paperclip
                      className="ml-1.5 inline h-3 w-3 text-[var(--subtle)]"
                      aria-label="Has an attached document"
                    />
                  )}
                </Td>
                <Td>
                  <span className="block max-w-[220px] truncate">{client.companyName}</span>
                  <span className="block max-w-[220px] truncate text-[12px] text-[var(--subtle)]">
                    {client.clientName}
                  </span>
                </Td>
                <Td>{submission.submissionType}</Td>
                <Td>{submission.lineOfBusiness}</Td>
                <Td>
                  <StatusBadge status={submission.status} />
                  {submission.needsHumanReview && submission.reviewReasons.length > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-[12px] text-[var(--muted)]">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {submission.reviewReasons.join(', ')}
                    </span>
                  )}
                </Td>
                <Td>{submission.assignedTeam}</Td>
                <Td className="text-right whitespace-nowrap">
                  <span className="block">{formatDate(submission.dateReceived)}</span>
                  <span className="block text-[12px] text-[var(--subtle)]">
                    {formatAge(submission.dateReceived)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="flex flex-col gap-3 md:hidden">
        {details.map(({ submission, client }) => (
          <li
            key={submission.submissionId}
            className="rounded-xl border border-[var(--border)] bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/ops/${submission.submissionId}`}
                className="font-mono text-[13px] font-medium text-[var(--accent)]"
              >
                {submission.submissionId}
              </Link>
              <StatusBadge status={submission.status} />
            </div>
            <p className="mt-2 font-medium">{client.companyName}</p>
            <p className="text-[13px] text-[var(--muted)]">
              {submission.submissionType} · {submission.lineOfBusiness}
            </p>
            <p className="mt-2 text-[12px] text-[var(--subtle)]">
              {submission.assignedTeam} · {formatAge(submission.dateReceived)}
            </p>
            {submission.reviewReasons.length > 0 && (
              <p className="mt-2 text-[12px] text-[var(--muted)]">
                {submission.reviewReasons.join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-[12px] font-semibold tracking-wide text-[var(--muted)] uppercase ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
}
