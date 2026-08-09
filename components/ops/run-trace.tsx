import { Check, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/dates'
import type { AutomationLog } from '@/lib/domain/types'

/**
 * Workflow run trace (NFR-007).
 *
 * Renders the step-by-step record of one run. Skipped steps are shown, not
 * hidden: "extraction skipped, no document supplied" is information an
 * operator needs, and omitting it would leave a gap that reads like a step
 * that never ran.
 */

const outcomeIcon = {
  ok: Check,
  skipped: Minus,
  failed: X,
} as const

const outcomeStyle = {
  ok: 'border-[#c9e7d1] bg-[#f1f9f3] text-[var(--ok)]',
  skipped: 'border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)]',
  failed: 'border-[#f0cfcd] bg-[#fdf2f1] text-[var(--danger)]',
} as const

export function RunTrace({ log }: { log: AutomationLog }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--border)] px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold">{log.workflowName}</p>
          <p className="font-mono text-[12px] text-[var(--subtle)]">{log.runId}</p>
        </div>
        <div className="text-right text-[12px] text-[var(--subtle)]">
          <p>{formatDateTime(log.started)}</p>
          <p>
            {log.status} · {log.durationMs ?? 0} ms
          </p>
        </div>
      </div>

      {log.steps.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-[var(--subtle)]">
          No step trace recorded for this run.
        </p>
      ) : (
        <ol className="flex flex-col">
          {log.steps.map((step, index) => {
            const Icon = outcomeIcon[step.outcome]
            return (
              <li
                key={`${step.step}-${index}`}
                className="flex gap-3 border-b border-[var(--border)] px-5 py-3 last:border-b-0"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    outcomeStyle[step.outcome],
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">
                    {step.step}
                    <span className="ml-2 font-normal text-[var(--subtle)]">
                      {step.outcome}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[var(--muted)]">
                    {step.detail}
                  </p>
                </div>
                <span className="shrink-0 text-[12px] tabular-nums text-[var(--subtle)]">
                  {step.durationMs} ms
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {log.errorMessage && (
        <div className="border-t border-[var(--border)] bg-[#fdf2f1] px-5 py-3">
          <p className="text-[12px] font-semibold text-[#8a1c16]">
            Failed at: {log.stepFailed}
            {log.retryCount > 0 && ` · ${log.retryCount} retr${log.retryCount === 1 ? 'y' : 'ies'}`}
          </p>
          <p className="mt-1 font-mono text-[12px] leading-snug break-words text-[#8a1c16]">
            {log.errorMessage}
          </p>
        </div>
      )}
    </div>
  )
}
