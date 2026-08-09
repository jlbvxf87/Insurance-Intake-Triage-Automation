import { cn } from '@/lib/utils/cn'

export function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'warn' | 'danger' | 'ok'
}) {
  const valueTone =
    tone === 'warn'
      ? 'text-[var(--warn)]'
      : tone === 'danger'
        ? 'text-[var(--danger)]'
        : tone === 'ok'
          ? 'text-[var(--ok)]'
          : 'text-[var(--foreground)]'

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-4">
      <p className="text-[13px] font-medium text-[var(--muted)]">{label}</p>
      <p className={cn('mt-2 text-3xl font-semibold tracking-tight tabular-nums', valueTone)}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[12px] leading-snug text-[var(--subtle)]">{hint}</p>
      )}
    </div>
  )
}
