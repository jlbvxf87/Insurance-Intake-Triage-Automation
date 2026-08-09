import { Card, MicroLabel, Section, SectionHeader } from './primitives'
import { CodeBlock } from './code-block'

const FIELDS = [
  { label: 'Named insured', value: 'ACME Trucking LLC', confidence: 98, required: true },
  { label: 'Policy number', value: 'CA-829103', confidence: 96, required: true },
  { label: 'Carrier', value: 'Example Insurance', confidence: 93, required: true },
  { label: 'Effective date', value: '2026-01-01', confidence: 92, required: false },
  { label: 'Expiration date', value: '2027-01-01', confidence: 91, required: false },
  { label: 'Coverage amount', value: '$1,000,000', confidence: 94, required: false },
]

const GATES = [
  { status: 'Validated', tone: 'ok', when: 'Aggregate ≥ threshold and all required fields present', then: 'Routes normally' },
  { status: 'Unverified', tone: 'warn', when: 'Aggregate below the threshold', then: 'Values retained, sent to review' },
  { status: 'Failed', tone: 'danger', when: 'A required field is absent', then: 'Values retained, intake correction' },
  { status: 'Exception', tone: 'danger', when: 'Response unparseable, timed out, or errored', then: 'Exceptions queue' },
]

const TONE_CLASS: Record<string, string> = {
  ok: 'border-[#c9e7d1] bg-[#f1f9f3] text-[#11602a]',
  warn: 'border-[#eddfb5] bg-[#fdf8ec] text-[#6f4a06]',
  danger: 'border-[#f0cfcd] bg-[#fdf2f1] text-[#8a1c16]',
}

const EXTRACTION_JSON = `{
  "namedInsured": "ACME Trucking LLC",
  "policyNumber": "CA-829103",
  "carrier": "Example Insurance",
  "effectiveDate": "2026-01-01",
  "expirationDate": "2027-01-01",
  "policyType": "Commercial Auto",
  "coverageAmount": 1000000,
  "fieldConfidence": {
    "namedInsured": 0.98,
    "policyNumber": 0.96,
    "carrier": 0.93
  },
  "extractionConfidence": 0.94
}`

/** AI document extraction (Phase 9). */
export function Extraction() {
  return (
    <Section id="extraction" tone="plain">
      <SectionHeader
        eyebrow="AI document extraction"
        title="The model proposes. It does not decide."
        lede="Azure AI Document Intelligence returns candidate values and a confidence for each. What the system does with them is governed by gates that are written down, configurable, and tested at the boundary."
      />

      <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3.5">
            <div>
              <h3 className="text-[14px] font-semibold">Extracted fields</h3>
              <p className="mt-0.5 text-[12px] text-[var(--subtle)]">
                acme-dec-page.pdf · aggregate 94% · threshold 80%
              </p>
            </div>
            <span className="rounded-md border border-[#c9e7d1] bg-[#f1f9f3] px-2 py-0.5 text-[12px] font-medium text-[#11602a]">
              Validated
            </span>
          </div>

          <dl className="divide-y divide-[var(--border)]">
            {FIELDS.map((field) => (
              <div
                key={field.label}
                className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5"
              >
                <dt className="truncate text-[13px] text-[var(--subtle)]">
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-[var(--accent)]" title="Required">
                      *
                    </span>
                  )}
                </dt>
                <dd className="truncate text-[13px] font-medium">{field.value}</dd>
                <dd className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--muted)] tabular-nums">
                  {field.confidence}%
                </dd>
              </div>
            ))}
          </dl>

          <p className="border-t border-[var(--border)] px-5 py-3.5 text-[12.5px] leading-relaxed text-[var(--subtle)]">
            Per-field confidence is retained, not just the aggregate. An
            aggregate tells a reviewer that <em>something</em> was uncertain.
            The breakdown tells them which value to check first — the difference
            between re-reading the document and confirming one number.
          </p>
        </Card>

        <div className="flex flex-col gap-4">
          <CodeBlock
            title="Normalized extraction — the shape every adapter returns"
            language="json"
            code={EXTRACTION_JSON}
          />

          <Card className="p-5">
            <MicroLabel>Confidence gates</MicroLabel>
            <ul className="mt-3 flex flex-col gap-2.5">
              {GATES.map((gate) => (
                <li key={gate.status} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium ${TONE_CLASS[gate.tone]}`}
                  >
                    {gate.status}
                  </span>
                  <span className="text-[13px] text-[var(--muted)]">
                    {gate.when}
                  </span>
                  <span className="text-[13px] text-[var(--subtle)]">
                    → {gate.then}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-[var(--border)] pt-3.5 text-[12.5px] leading-relaxed text-[var(--subtle)]">
              The threshold is <strong className="font-medium">inclusive</strong>{' '}
              and tested at exactly 0.80, because &ldquo;below the
              threshold&rdquo; is ambiguous in prose and the boundary is where an
              off-by-one silently changes behaviour for a whole class of
              submissions.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  )
}
