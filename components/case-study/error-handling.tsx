import { Card, MicroLabel, Section, SectionHeader } from './primitives'

const STATES = [
  { name: 'New', to: 'Processing, Exception', tone: 'neutral' },
  { name: 'Processing', to: 'Routed, In Review, Duplicate, Exception', tone: 'accent' },
  { name: 'Routed', to: 'In Review, Closed', tone: 'ok' },
  { name: 'In Review', to: 'Routed, Duplicate, Closed', tone: 'warn' },
  { name: 'Duplicate', to: 'Routed, In Review, Closed', tone: 'violet' },
  { name: 'Exception', to: 'Processing, In Review, Routed, Closed', tone: 'danger' },
  { name: 'Closed', to: 'terminal', tone: 'muted' },
]

const TONE: Record<string, string> = {
  neutral: 'border-[var(--border-strong)] bg-white text-[var(--muted)]',
  accent: 'border-[#d7e3f8] bg-[var(--accent-soft)] text-[#12457f]',
  ok: 'border-[#c9e7d1] bg-[#f1f9f3] text-[#11602a]',
  warn: 'border-[#eddfb5] bg-[#fdf8ec] text-[#6f4a06]',
  violet: 'border-[#e3d7f5] bg-[#f7f3fd] text-[#54318c]',
  danger: 'border-[#f0cfcd] bg-[#fdf2f1] text-[#8a1c16]',
  muted: 'border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)]',
}

const REVIEW_ACTIONS = [
  { action: 'Release', effect: 'Applies routing, clears the flags, notifies the submitter' },
  { action: 'Correct extraction', effect: 'Updates values and marks them Validated — status unchanged' },
  { action: 'Dismiss duplicate', effect: 'Clears the flag and reason, routes normally' },
  { action: 'Confirm duplicate', effect: 'Closes it, keeping the duplicate reason on the record' },
  { action: 'Close', effect: 'Resolved with no team assignment' },
]

const CANNOT = [
  'Change the line of business — a different line is a different request',
  'Delete a submission — no path removes a business record',
  'Merge clients — flagged for a data owner, never automatic',
  'Edit extraction confidence — it records what the model reported',
]

/** Error handling and human review (Phase 9). */
export function ErrorHandling() {
  return (
    <Section id="error-handling" tone="plain">
      <SectionHeader
        eyebrow="Error handling & human review"
        title="No workflow step fails silently"
        lede="Every failure produces three things: a status that is not Processing, a log entry naming the step that failed, and a queue where a person can act on it. A failure that is not visible is treated as a defect."
      />

      <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Card className="p-5 sm:p-6">
          <MicroLabel>State machine</MicroLabel>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
            Transitions are declared as data and enforced. Without the table, a
            bug in a review handler could move an Exception straight to Closed
            and the audit trail would show a transition the design never
            intended.
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {STATES.map((state) => (
              <li
                key={state.name}
                className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1"
              >
                <span
                  className={`inline-flex rounded-md border px-2 py-0.5 text-[12px] font-medium ${TONE[state.tone]}`}
                >
                  {state.name}
                </span>
                <span className="text-[var(--subtle)]">→</span>
                <span className="text-[12.5px] text-[var(--muted)]">
                  {state.to}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 border-t border-[var(--border)] pt-3.5 text-[12.5px] leading-relaxed text-[var(--subtle)]">
            Closed is terminal. Reopening creates a new submission rather than
            resurrecting a closed one, so the record of what was decided — and
            when — stays intact.
          </p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5 sm:p-6">
            <MicroLabel>What a reviewer can do</MicroLabel>
            <dl className="mt-3 divide-y divide-[var(--border)]">
              {REVIEW_ACTIONS.map((item) => (
                <div key={item.action} className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-4">
                  <dt className="text-[13px] font-medium">{item.action}</dt>
                  <dd className="text-[13px] text-[var(--muted)]">{item.effect}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-[var(--border)] pt-3.5 text-[12.5px] leading-relaxed text-[var(--subtle)]">
              Correcting extracted data does not release the submission.
              Correcting and releasing are separate deliberate acts, so a
              reviewer can fix a policy number without committing to the routing
              decision in the same click. Every action writes a log entry naming
              the actor — the audit trail does not go quiet the moment a human
              takes over.
            </p>
          </Card>

          <Card className="p-5 sm:p-6">
            <MicroLabel>What a reviewer deliberately cannot do</MicroLabel>
            <ul className="mt-3 flex flex-col gap-2">
              {CANNOT.map((item) => (
                <li key={item} className="flex gap-2.5 text-[13px] text-[var(--muted)]">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--subtle)]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="border-[#eddfb5] bg-[#fdf8ec] p-5">
            <p className="text-[13px] font-semibold text-[#6f4a06]">
              Escalation is not failure
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#6f4a06]">
              A run that correctly sent a low-confidence extraction to a human
              did its job. It is logged as <strong>Needs Review</strong>, not
              Failed — counting it as a failure would make automation health read
              as broken every time the system did the right thing.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  )
}
