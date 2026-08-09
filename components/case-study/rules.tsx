import { ArrowRight } from 'lucide-react'
import { Card, MicroLabel, Section, SectionHeader } from './primitives'
import { EXCEPTION_TABLE, ROUTING_TABLE } from '@/lib/case-study/content'

const PRECEDENCE = ['Exception', 'Duplicate', 'In Review', 'Routed']

/** Duplicate detection and business rules (Phase 9). */
export function Rules() {
  return (
    <Section id="rules" tone="light">
      <SectionHeader
        eyebrow="Duplicate detection & business rules"
        title="Deterministic where it can be, escalating where it can't"
        lede="Routing is a lookup table an operations lead can read. Everything that could make the lookup wrong is a gate in front of it."
      />

      <div className="mt-9 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-3.5">
            <h3 className="text-[14px] font-semibold">Routing rules</h3>
            <p className="mt-0.5 text-[12px] text-[var(--subtle)]">
              Expressed as data, not control flow. Adding a line of business is
              one line.
            </p>
          </div>
          <table className="w-full text-[13px]">
            <caption className="sr-only">Line of business to assigned team</caption>
            <tbody>
              {ROUTING_TABLE.map((row) => (
                <tr
                  key={row.rule}
                  className="border-b border-[var(--border)] last:border-b-0"
                >
                  <td className="px-5 py-2.5">{row.lob}</td>
                  <td className="w-6 py-2.5 text-[var(--subtle)]">
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </td>
                  <td className="py-2.5 font-medium">{row.team}</td>
                  <td className="px-5 py-2.5 text-right font-mono text-[11.5px] text-[var(--subtle)]">
                    {row.rule}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--border)] px-5 py-3.5 text-[12.5px] leading-relaxed text-[var(--subtle)]">
            An unrecognized line of business does not fail and does not silently
            pick a default. It routes to General Intake <em>and</em> flags for
            review — so the submission keeps moving while a human is told the
            rules table has a gap.
          </p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <MicroLabel>Duplicate rule · BR-013</MicroLabel>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--muted)]">
              A submission is a <strong className="font-medium text-[var(--foreground)]">possible</strong>{' '}
              duplicate when all four hold: the normalized client email matches,
              the submission type matches, the line of business matches, and the
              earlier submission falls inside the configured window.
            </p>
            <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-[13px] text-[var(--muted)]">
              <li>
                <strong className="font-medium text-[var(--foreground)]">
                  Never auto-rejects.
                </strong>{' '}
                It flags, states a reason, and hands the decision to a person.
              </li>
              <li>
                <strong className="font-medium text-[var(--foreground)]">
                  Failed runs are not evidence.
                </strong>{' '}
                Prior submissions in Exception status are excluded, so a service
                outage cannot trap a client in review.
              </li>
              <li>
                <strong className="font-medium text-[var(--foreground)]">
                  The window is a dial.
                </strong>{' '}
                Thirty days by default, changed without touching code.
              </li>
            </ul>
          </Card>

          <Card className="p-5">
            <MicroLabel>Exception precedence · BR-020</MicroLabel>
            <ol className="mt-3 flex flex-wrap items-center gap-2">
              {PRECEDENCE.map((status, index) => (
                <li key={status} className="flex items-center gap-2">
                  <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12.5px] font-medium">
                    {status}
                  </span>
                  {index < PRECEDENCE.length - 1 && (
                    <span className="text-[var(--subtle)]">&gt;</span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-3.5 text-[13px] leading-relaxed text-[var(--muted)]">
              Precedence decides the <em>status</em>. It does not discard the
              other reasons — a submission that is both a duplicate and
              low-confidence shows as Duplicate and carries both, because the
              reviewer needs to know about the confidence problem while they
              adjudicate the duplicate.
            </p>
          </Card>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3.5">
          <h3 className="text-[14px] font-semibold">Every escalation path</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-left">
                <th scope="col" className="px-5 py-2.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  Condition
                </th>
                <th scope="col" className="px-5 py-2.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  Status
                </th>
                <th scope="col" className="px-5 py-2.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  Queue
                </th>
              </tr>
            </thead>
            <tbody>
              {EXCEPTION_TABLE.map((row) => (
                <tr key={row.condition} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-5 py-2.5 text-[var(--muted)]">{row.condition}</td>
                  <td className="px-5 py-2.5 font-medium">{row.status}</td>
                  <td className="px-5 py-2.5 text-[var(--muted)]">{row.queue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  )
}
