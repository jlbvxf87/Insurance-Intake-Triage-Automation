import { Container, Eyebrow } from './primitives'
import { CodeBlock } from './code-block'
import { DEFECTS, TEST_SUITES } from '@/lib/case-study/content'

const OUTPUT = `$ npm run typecheck     tsc --noEmit         no errors
$ npm run lint          eslint               no errors, no warnings
$ npm run build         next build           succeeded
$ npm test              vitest run           188 passed (188)`

const GAPS = [
  'The Azure adapter is tested against an injected fetch — success, polling, retry, timeout, malformed response — but has not been run against a live Document Intelligence resource.',
  'Accessibility was built to spec and checked by hand. An automated axe-core pass would be stronger.',
  'If the automation log store itself is unavailable, nothing further can be recorded through it. A production deployment needs a second sink.',
]

/** Testing (Phase 9). */
export function Testing() {
  return (
    <section
      id="testing"
      className="scroll-mt-20 bg-[var(--ink)] py-14 text-[var(--ink-foreground)] sm:py-20"
    >
      <Container>
        <div className="flex flex-col gap-3">
          <Eyebrow dark>Testing</Eyebrow>
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance text-white sm:text-[32px] sm:leading-[1.15]">
            188 tests, and the five defects they found
          </h2>
          <p className="max-w-2xl leading-relaxed text-[var(--ink-muted)] text-pretty">
            &ldquo;The tests pass&rdquo; is only meaningful if the tests ever
            failed. Failure paths are exercised by injecting failures — a
            repository that throws, an adapter that returns a chosen failure
            kind, an injected <code className="font-mono text-[13px] text-[#9aa2ff]">fetch</code>,
            an injected clock — never by disabling the code under test.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <CodeBlock
              title="Recorded output · 9 August 2026"
              language="bash"
              code={OUTPUT}
              showLineNumbers={false}
            />

            <div className="overflow-hidden rounded-[14px] border border-[var(--ink-border)] bg-[var(--ink-soft)]">
              <table className="w-full text-[13px]">
                <caption className="sr-only">Test suites and counts</caption>
                <tbody>
                  {TEST_SUITES.map((suite) => (
                    <tr
                      key={suite.file}
                      className="border-b border-[var(--ink-border)] last:border-b-0"
                    >
                      <td className="px-4 py-2.5 align-top">
                        <span className="font-mono text-[12.5px] text-[#9aa2ff]">
                          {suite.file}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-[var(--ink-muted)]">
                          {suite.covers}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right align-top font-mono text-[13px] text-[#6ee7a0] tabular-nums">
                        {suite.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold tracking-[0.08em] text-[var(--ink-muted)] uppercase">
              Defects found
            </p>

            {DEFECTS.map((defect) => (
              <div
                key={defect.id}
                className="rounded-[14px] border border-[var(--ink-border)] bg-[var(--ink-soft)] p-4"
              >
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[12px] font-semibold text-[#ff9d95]">
                    {defect.id}
                  </span>
                  <h3 className="text-[13.5px] font-semibold text-white">
                    {defect.title}
                  </h3>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-muted)]">
                  {defect.body}
                </p>
              </div>
            ))}

            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
              The first two were <strong className="font-medium text-white">silent</strong>.
              Neither threw, neither logged, and both produced a
              plausible-looking wrong answer — exactly the class of defect the
              confidence gates and audit trail exist to catch, and exactly the
              class that reading the code would not have surfaced.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[14px] border border-[var(--ink-border)] bg-[#12161d] p-5">
          <p className="text-[13px] font-semibold text-white">
            Known gaps — stated rather than hidden
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {GAPS.map((gap) => (
              <li
                key={gap}
                className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--ink-muted)]"
              >
                <span
                  className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[#4d5764]"
                  aria-hidden="true"
                />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}
