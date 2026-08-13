import { ChevronRight } from 'lucide-react'
import { Card, MicroLabel, Section, SectionHeader } from './primitives'
import { IconTile, type IconName, type Tone } from './icon'
import { CodeBlock } from './code-block'
import { ARCHITECTURE_COLUMNS, ROUTING_RULE_SAMPLE } from '@/lib/case-study/content'

/** Architecture — inputs, services, business logic, outputs (Phase 9). */
export function Architecture() {
  return (
    <Section id="architecture" tone="plain">
      <SectionHeader
        eyebrow="Architecture"
        title="Four boundaries, one contract"
        lede="Extraction sits behind an adapter, persistence behind a repository, and the orchestrator depends on neither concretely. That is what lets the whole failure matrix be tested without a network or a database — and what makes swapping the fixture provider for Azure a configuration change."
      />

      <div className="mt-9 grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ARCHITECTURE_COLUMNS.map((column, columnIndex) => (
              <div key={column.title} className="relative flex min-w-0 flex-col gap-2.5">
                <MicroLabel>{column.title}</MicroLabel>

                <ul className="flex flex-col gap-2">
                  {column.items.map((item) => (
                    <li
                      key={item.label}
                      className="flex h-[66px] min-w-0 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-white px-2.5"
                    >
                      <IconTile
                        name={item.icon as IconName}
                        tone={item.tone as Tone}
                        size="sm"
                      />
                      {/* min-w-0 lets a long service name wrap instead of
                          setting a min-content floor that widens the whole
                          grid track — the cause of a page-level horizontal
                          scrollbar below 1024px.

                          Wrapping at spaces only. `break-words` was splitting
                          labels mid-word — "Documen/t", "Datavers/e",
                          "Dashboar/d" — which reads as a rendering fault
                          rather than a tight column. No label here contains a
                          word long enough to need breaking. */}
                      <span className="min-w-0 text-[12.5px] leading-tight [overflow-wrap:normal] text-[var(--foreground)]">
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {columnIndex < ARCHITECTURE_COLUMNS.length - 1 && (
                  <ChevronRight
                    className="absolute top-1/2 -right-[13px] hidden h-4 w-4 text-[#c4c9d2] xl:block"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-5 sm:grid-cols-3">
            {[
              {
                title: 'Credentials never reach the client',
                body: 'The browser posts the document to this application. The server calls Azure. No NEXT_PUBLIC_ variable exists.',
              },
              {
                title: 'The orchestrator takes its dependencies',
                body: 'Repository, extractor, config, and clock are injected — so a write failure or a timeout is a test, not a thought experiment.',
              },
              {
                title: 'One vocabulary, two implementations',
                body: 'Field names, option sets, and status values are identical in TypeScript and in the documented Dataverse schema.',
              },
            ].map((note) => (
              <div key={note.title}>
                <p className="text-[13px] font-semibold">{note.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--subtle)]">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <CodeBlock
            title="Routing rule — shape of the decision"
            language="json"
            code={ROUTING_RULE_SAMPLE}
          />
          <p className="text-[13px] leading-relaxed text-[var(--subtle)]">
            Routing is a pure function of validated inputs, so identical inputs
            always produce the same team. The gates below it are the only things
            that can stop a submission — and each one names the rule it came
            from.
          </p>
        </div>
      </div>
    </Section>
  )
}
