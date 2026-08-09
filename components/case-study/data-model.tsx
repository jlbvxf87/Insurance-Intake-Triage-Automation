import { Card, MicroLabel, Section, SectionHeader } from './primitives'

const ENTITIES = [
  {
    name: 'Client',
    logical: 'iit_client',
    fields: ['clientId', 'clientName', 'companyName', 'email', 'normalizedEmail', 'phone', 'clientType', 'createdDate', 'active'],
    note: 'Alternate key on normalizedEmail. Matching is a keyed lookup, and an accidental duplicate is a platform-level constraint violation rather than a logic bug.',
  },
  {
    name: 'Submission',
    logical: 'iit_submission',
    fields: ['submissionId', 'clientId →', 'submissionType', 'lineOfBusiness', 'description', 'dateReceived', 'status', 'assignedTeam', 'duplicateFlag', 'duplicateReason', 'confidenceScore', 'needsHumanReview', 'reviewReasons', 'source', 'originalDocument'],
    note: 'reviewReasons is multi-select. A submission can be both a possible duplicate and low-confidence, and storing one reason would discard what the reviewer needs.',
  },
  {
    name: 'ExtractedPolicyData',
    logical: 'iit_extractedpolicydata',
    fields: ['extractionId', 'submissionId →', 'carrier', 'policyNumber', 'namedInsured', 'policyType', 'effectiveDate', 'expirationDate', 'coverageAmount', 'extractionConfidence', 'fieldConfidence', 'validationStatus', 'missingFields', 'provider'],
    note: 'One-to-one, enforced by an alternate key rather than by the flow remembering. Per-field confidence is retained, not just the aggregate.',
  },
  {
    name: 'AutomationLog',
    logical: 'iit_automationlog',
    fields: ['logId', 'submissionId →', 'workflowName', 'runId', 'started', 'completed', 'durationMs', 'status', 'stepFailed', 'errorMessage', 'retryCount', 'steps'],
    note: 'stepFailed is a Choice, not free text — which is the only reason "top errors" aggregates reliably instead of listing one-offs.',
  },
]

/** Data model (Phase 9). */
export function DataModel() {
  return (
    <Section id="data-model" tone="light">
      <SectionHeader
        eyebrow="Data model"
        title="Four tables, and the reasons behind them"
        lede="The same model in Dataverse and in TypeScript, field for field. Documentation that drifts from the running code is worse than none, because it is trusted."
      />

      <div className="mt-9 overflow-x-auto">
        <pre className="min-w-max font-mono text-[12.5px] leading-[1.9] text-[var(--muted)]">
{`CLIENT ──1:N──► SUBMISSION ──1:1──► EXTRACTED POLICY DATA
                     │
                     └────1:N──► AUTOMATION LOG`}
        </pre>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {ENTITIES.map((entity) => (
          <Card as="li" key={entity.name} className="flex flex-col p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-[15px] font-semibold">{entity.name}</h3>
              <code className="font-mono text-[12px] text-[var(--subtle)]">
                {entity.logical}
              </code>
            </div>

            <MicroLabel className="mt-4">Columns</MicroLabel>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {entity.fields.map((field) => (
                <li
                  key={field}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11.5px] text-[var(--muted)]"
                >
                  {field}
                </li>
              ))}
            </ul>

            <p className="mt-4 border-t border-[var(--border)] pt-3.5 text-[13px] leading-relaxed text-[var(--subtle)]">
              {entity.note}
            </p>
          </Card>
        ))}
      </ul>

      <Card className="mt-4 p-5">
        <MicroLabel>One detail worth pulling out</MicroLabel>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--muted)]">
          <code className="font-mono text-[13px] text-[var(--foreground)]">
            confidenceScore
          </code>{' '}
          is nullable, and the distinction carries weight. Null means{' '}
          <em>no document was supplied</em>. Zero would mean{' '}
          <em>extraction ran and returned nothing trustworthy</em>. Collapsing
          them into one value would make a perfectly normal submission
          indistinguishable from a failed one in every report built on top —
          which is the kind of decision that is cheap now and expensive in
          eighteen months.
        </p>
      </Card>
    </Section>
  )
}
