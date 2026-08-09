import { Card, MicroLabel, Section, SectionHeader } from './primitives'

const COUNTS = [
  { value: '37', label: 'Functional requirements' },
  { value: '20', label: 'Business rules' },
  { value: '17', label: 'Non-functional requirements' },
  { value: '17', label: 'Acceptance criteria' },
]

const SAMPLE_AC = {
  id: 'AC-006',
  title: 'Low-confidence extraction routes to review',
  given: 'a document is analyzed successfully and the threshold is 0.80,',
  when: 'aggregate extraction confidence is 0.62,',
  then: [
    'retain every extracted value,',
    'set validationStatus to Unverified,',
    'set needsHumanReview to true,',
    'set the status to In Review,',
    'and retain per-field confidences so the reviewer can see which field was weak.',
  ],
  and: 'Given confidence is exactly 0.80, the extraction is Validated and routed — the threshold is inclusive.',
}

const TRACE = [
  ['P-2 Transcription errors', 'FR-006', 'AC-006', 'TC-06'],
  ['P-3 Duplicate client records', 'FR-017', 'AC-002', 'TC-02'],
  ['P-4 Missed duplicate submissions', 'BR-013', 'AC-004', 'TC-04'],
  ['P-5 Inconsistent routing', 'FR-007', 'AC-010', 'TC-10'],
  ['P-7 No operational visibility', 'FR-037', 'AC-017', 'TC-17'],
  ['P-8 No audit trail', 'FR-032', 'AC-012', 'TC-12'],
]

/** Requirements and acceptance criteria (Phase 9). */
export function Requirements() {
  return (
    <Section id="requirements" tone="plain">
      <SectionHeader
        eyebrow="Requirements & acceptance criteria"
        title="Written before the code, traced through to the tests"
        lede="Every pain point in the current-state analysis maps to a requirement, every requirement to an acceptance criterion, and every criterion to a test case. The chain is the deliverable — it is what lets someone else maintain this."
      />

      <dl className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {COUNTS.map((item) => (
          <Card key={item.label} className="px-4 py-4">
            <dt className="text-[12.5px] text-[var(--subtle)]">{item.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {item.value}
            </dd>
          </Card>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[12px] font-semibold text-[var(--accent)]">
              {SAMPLE_AC.id}
            </span>
            <h3 className="text-[15px] font-semibold">{SAMPLE_AC.title}</h3>
          </div>

          <dl className="mt-4 flex flex-col gap-3 text-[13.5px] leading-relaxed">
            <div>
              <dt className="font-semibold">Given</dt>
              <dd className="text-[var(--muted)]">{SAMPLE_AC.given}</dd>
            </div>
            <div>
              <dt className="font-semibold">When</dt>
              <dd className="text-[var(--muted)]">{SAMPLE_AC.when}</dd>
            </div>
            <div>
              <dt className="font-semibold">Then the system shall</dt>
              <dd>
                <ul className="mt-1 flex flex-col gap-1 text-[var(--muted)]">
                  {SAMPLE_AC.then.map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <span
                        className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[var(--subtle)]"
                        aria-hidden="true"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>

          <p className="mt-4 border-t border-[var(--border)] pt-3.5 text-[13px] leading-relaxed text-[var(--subtle)]">
            {SAMPLE_AC.and}
          </p>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-3.5">
            <MicroLabel>Traceability</MicroLabel>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left">
                  {['Pain point', 'Requirement', 'Criterion', 'Test'].map((head) => (
                    <th
                      key={head}
                      scope="col"
                      className="px-5 py-2.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRACE.map((row) => (
                  <tr key={row[0]} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-5 py-2.5 text-[var(--muted)]">{row[0]}</td>
                    {row.slice(1).map((cell) => (
                      <td key={cell} className="px-5 py-2.5 font-mono text-[12px]">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--border)] px-5 py-3.5 text-[12.5px] leading-relaxed text-[var(--subtle)]">
            The full matrix is in{' '}
            <code className="font-mono text-[12px]">docs/requirements.md</code> §6.
          </p>
        </Card>
      </div>
    </Section>
  )
}
