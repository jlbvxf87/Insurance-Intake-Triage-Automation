import { ArrowRight } from 'lucide-react'
import { Card, MicroLabel, Section, SectionHeader } from './primitives'
import { BEFORE_AFTER } from '@/lib/case-study/content'

const CURRENT = [
  'Email received',
  'Employee opens and reads',
  'Downloads the attachment',
  'Reads the document for policy fields',
  'Searches the CRM',
  'Checks for duplicates by eye',
  'Retypes the data',
  'Determines the owning team',
  'Forwards the request',
  'Sends an acknowledgement',
]

const FUTURE = [
  'Digital intake',
  'Automated validation',
  'AI document extraction',
  'Extraction validation',
  'CRM match on a normalized key',
  'Duplicate detection',
  'Deterministic business rules',
  'Automated routing',
  'Customer confirmation',
  'Exception monitoring',
]

/** Current state → future state, and the measured difference (Phase 9). */
export function StateComparison() {
  return (
    <Section id="states" tone="light">
      <SectionHeader
        eyebrow="Process analysis"
        title="Current state → future state"
        lede="Each of the ten manual steps was classified as mechanical or judgement. The mechanical ones were automated. The judgement ones were kept — and given a queue, a stated reason, and an owner."
      />

      <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <Card className="p-5 sm:p-6">
          <MicroLabel>Current — manual intake</MicroLabel>
          <ol className="mt-4 flex flex-col gap-2">
            {CURRENT.map((step, index) => (
              <li key={step} className="flex items-baseline gap-3 text-[13.5px]">
                <span className="w-4 shrink-0 font-mono text-[11px] text-[var(--subtle)]">
                  {index + 1}
                </span>
                <span className="text-[var(--muted)]">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-[var(--border)] pt-4 text-[13px] text-[var(--subtle)]">
            No system of record for the work itself. Queue depth, ageing, and
            failure causes are not observable.
          </p>
        </Card>

        <div className="flex items-center justify-center lg:px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white">
            <ArrowRight
              className="h-4 w-4 rotate-90 text-[var(--muted)] lg:rotate-0"
              aria-hidden="true"
            />
          </span>
        </div>

        <Card className="p-5 sm:p-6">
          <MicroLabel>Future — automated triage</MicroLabel>
          <ol className="mt-4 flex flex-col gap-2">
            {FUTURE.map((step, index) => (
              <li key={step} className="flex items-baseline gap-3 text-[13.5px]">
                <span className="w-4 shrink-0 font-mono text-[11px] text-[var(--accent)]">
                  {index + 1}
                </span>
                <span className="text-[var(--foreground)]">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-[var(--border)] pt-4 text-[13px] text-[var(--subtle)]">
            Every run writes an audit record, so the process finally produces
            data about itself.
          </p>
        </Card>
      </div>

      {/* Before / after figures */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[#fdf2f1] px-5 py-3">
            <MicroLabel className="text-[#8a1c16]">
              {BEFORE_AFTER.before.label}
            </MicroLabel>
          </div>
          <dl className="divide-y divide-[var(--border)]">
            {BEFORE_AFTER.before.rows.map((row) => (
              <div key={row.caption} className="px-5 py-3.5">
                <dt className="text-lg font-semibold tracking-tight">{row.value}</dt>
                <dd className="mt-0.5 text-[13px] text-[var(--subtle)]">
                  {row.caption}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[#f1f9f3] px-5 py-3">
            <MicroLabel className="text-[#11602a]">
              {BEFORE_AFTER.after.label}
            </MicroLabel>
          </div>
          <dl className="divide-y divide-[var(--border)]">
            {BEFORE_AFTER.after.rows.map((row) => (
              <div key={row.caption} className="px-5 py-3.5">
                <dt className="text-lg font-semibold tracking-tight">{row.value}</dt>
                <dd className="mt-0.5 text-[13px] text-[var(--subtle)]">
                  {row.caption}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-[var(--subtle)]">
        Timings are <strong className="font-medium text-[var(--muted)]">modeled
        assumptions</strong>, stated as such so a reader can substitute their
        own. The sensitivity is the interesting part: straight-through rate is
        the variable the whole case rests on, which is why the confidence
        threshold is a configurable dial rather than a constant. Working shown
        in <code className="font-mono text-[12px]">docs/business-case.md</code>.
      </p>
    </Section>
  )
}
