import { cn } from '@/lib/utils/cn'
import type { SubmissionStatus, ValidationStatus } from '@/lib/domain/enums'

/**
 * Status badges (NFR-011).
 *
 * Every badge carries a text label, and each status also carries a distinct
 * dot shape/colour. Colour is never the only carrier of meaning — the label
 * alone is sufficient to read the status.
 */

const statusStyles: Record<SubmissionStatus, string> = {
  New: 'border-[var(--border-strong)] bg-white text-[var(--muted)]',
  Processing: 'border-[#d7e3f8] bg-[var(--accent-soft)] text-[#12457f]',
  Routed: 'border-[#c9e7d1] bg-[#f1f9f3] text-[#11602a]',
  'In Review': 'border-[#eddfb5] bg-[#fdf8ec] text-[#6f4a06]',
  Duplicate: 'border-[#e3d7f5] bg-[#f7f3fd] text-[#54318c]',
  Exception: 'border-[#f0cfcd] bg-[#fdf2f1] text-[#8a1c16]',
  Closed: 'border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)]',
}

const statusDots: Record<SubmissionStatus, string> = {
  New: 'bg-[var(--subtle)]',
  Processing: 'bg-[var(--accent)]',
  Routed: 'bg-[var(--ok)]',
  'In Review': 'bg-[var(--warn)]',
  Duplicate: 'bg-[#7c4dbd]',
  Exception: 'bg-[var(--danger)]',
  Closed: 'bg-[#bdbdbd]',
}

export function StatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap',
        statusStyles[status],
        className,
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', statusDots[status])}
        aria-hidden="true"
      />
      {status}
    </span>
  )
}

const validationStyles: Record<ValidationStatus, string> = {
  Validated: 'border-[#c9e7d1] bg-[#f1f9f3] text-[#11602a]',
  Unverified: 'border-[#eddfb5] bg-[#fdf8ec] text-[#6f4a06]',
  Failed: 'border-[#f0cfcd] bg-[#fdf2f1] text-[#8a1c16]',
  'Not Applicable': 'border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)]',
}

export function ValidationBadge({
  status,
  className,
}: {
  status: ValidationStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap',
        validationStyles[status],
        className,
      )}
    >
      {status}
    </span>
  )
}

export function Tag({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[12px] text-[var(--muted)] whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}
