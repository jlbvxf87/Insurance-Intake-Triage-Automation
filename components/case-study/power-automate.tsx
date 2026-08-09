import { Container, Eyebrow } from './primitives'
import { CodeBlock } from './code-block'

const SCOPES = [
  {
    name: 'TRY',
    tone: 'border-[#1e3a6b] bg-[#101a2e]',
    label: 'text-[#7cb0ff]',
    actions: [
      'Validate submission',
      'Resolve client — list rows / add a row',
      'Update submission → Processing',
      'Duplicate check — list rows with an OData filter',
      'Extract document — HTTP + do until + parse JSON',
      'Validate extraction',
      'Apply business rules — switch',
      'Update submission with the outcome',
      'Send confirmation',
    ],
  },
  {
    name: 'CATCH',
    tone: 'border-[#5c2320] bg-[#241110]',
    label: 'text-[#ff9d95]',
    actions: [
      'Filter result(\'TRY\') where status is Failed',
      'Update submission → Exception',
      'Post a message to the operations channel',
    ],
    runAfter: 'has failed · is skipped · has timed out',
  },
  {
    name: 'FINALLY',
    tone: 'border-[#39414d] bg-[#161b22]',
    label: 'text-[#a9b4c2]',
    actions: ['Create the Automation Log row', 'Set completion time and duration'],
    runAfter: 'is successful · has failed · is skipped · has timed out',
  },
]

const EXPRESSION = `first(
  filter(
    result('TRY'),
    equals(item()?['status'], 'Failed')
  )
)?['name']`

/** Power Automate workflow (Phase 9). */
export function PowerAutomate() {
  return (
    <section
      id="power-automate"
      className="scroll-mt-20 bg-[var(--ink)] py-14 text-[var(--ink-foreground)] sm:py-20"
    >
      <Container>
        <div className="flex flex-col gap-3">
          <Eyebrow dark>Power Automate</Eyebrow>
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance text-white sm:text-[32px] sm:leading-[1.15]">
            The same design, in the Power Platform idiom
          </h2>
          <p className="max-w-2xl leading-relaxed text-[var(--ink-muted)] text-pretty">
            Four scopes, mapped action-by-action to the reference
            implementation. The <code className="font-mono text-[13px] text-[#9aa2ff]">configure run after</code>{' '}
            settings are the whole mechanism — they are what makes FINALLY
            unconditional, and therefore what guarantees an audit row exists for
            every run, including the ones where the error handling itself went
            wrong.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {SCOPES.map((scope) => (
              <div
                key={scope.name}
                className={`rounded-[14px] border px-4 py-3.5 ${scope.tone}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className={`font-mono text-[12px] font-semibold tracking-wider ${scope.label}`}>
                    SCOPE: {scope.name}
                  </p>
                  {scope.runAfter && (
                    <p className="font-mono text-[11px] text-[#6b7785]">
                      run after: {scope.runAfter}
                    </p>
                  )}
                </div>
                <ol className="mt-2.5 flex flex-col gap-1">
                  {scope.actions.map((action, index) => (
                    <li
                      key={action}
                      className="flex gap-2.5 text-[12.5px] text-[#c9d1d9]"
                    >
                      <span className="w-4 shrink-0 text-right font-mono text-[11px] text-[#4d5764]">
                        {index + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <CodeBlock
              title="Which action failed — the expression behind stepFailed"
              language="text"
              code={EXPRESSION}
              showLineNumbers={false}
            />

            <div className="rounded-[14px] border border-[var(--ink-border)] bg-[var(--ink-soft)] p-5">
              <p className="text-[13px] font-semibold text-white">
                Why this expression matters
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
                <code className="font-mono text-[12.5px] text-[#9aa2ff]">result(&apos;TRY&apos;)</code>{' '}
                returns the outcome of every action in the scope. Filtering it is
                what makes the log say <em>which</em> action failed rather than
                only that the flow did. Both implementations keep the{' '}
                <strong className="font-medium text-white">first</strong>{' '}
                failure as the reported one — a later failure is usually a
                consequence of the first, and reporting the last would point an
                operator at the symptom instead of the cause.
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--ink-border)] pt-4 text-[12.5px]">
                {[
                  ['Retry policy', '5xx and 429 · 3 attempts'],
                  ['Not retried', '4xx, timeout, malformed'],
                  ['Deadline', 'Whole operation, not per request'],
                  ['Secrets', 'Key Vault environment variable'],
                ].map(([term, value]) => (
                  <div key={term}>
                    <dt className="text-[#6b7785]">{term}</dt>
                    <dd className="mt-0.5 text-[#c9d1d9]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
