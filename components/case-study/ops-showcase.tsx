import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, MicroLabel, Section, SectionHeader } from './primitives'

const SHOTS = [
  {
    src: '/screenshots/03-ops-dashboard.webp',
    width: 1120,
    height: 1244,
    title: 'Submission queue',
    body: 'Ten filterable views, KPI counters, automation health, and the ageing signal for whatever has been waiting on a person longest.',
    href: '/ops',
    priority: true,
  },
  {
    src: '/screenshots/07-submission-exception.webp',
    width: 1120,
    height: 1139,
    title: 'Run trace for a failed extraction',
    body: 'Every step, including the ones deliberately skipped, with the failing action and its message. This is what makes a routing decision reconstructable after the fact.',
    href: '/ops',
  },
  {
    src: '/screenshots/06-submission-low-confidence.webp',
    width: 1120,
    height: 1166,
    title: 'Per-field confidence and a missing field',
    body: 'The reviewer sees which value was weak and which was absent — not just that the aggregate fell short.',
    href: '/ops',
  },
  {
    src: '/screenshots/01-intake-form.webp',
    width: 1120,
    height: 1088,
    title: 'Public intake',
    body: 'Validated in the browser and again on the server against the same schema. Demo mode is stated, never implied.',
    href: '/intake',
  },
]

const KPIS = [
  { label: 'Queue views', value: '10' },
  { label: 'Entities', value: '4' },
  { label: 'Business rules', value: '20' },
  { label: 'Automated tests', value: '188' },
]

/** Operations dashboard showcase — product UI as the visual (Phase 9). */
export function OpsShowcase() {
  return (
    <Section id="dashboard" tone="light">
      <SectionHeader
        eyebrow="Operations"
        title="The dashboard is the deliverable"
        lede="Not a mockup. These are captures of the running application against seeded synthetic data — and both surfaces are live, so every claim on this page can be checked in about two minutes."
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/ops"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-white transition-colors hover:bg-[#242424]"
        >
          Open the dashboard
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/intake"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-white px-4 text-sm font-medium transition-colors hover:bg-white/60"
        >
          Submit a test request
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPIS.map((kpi) => (
          <Card key={kpi.label} className="px-4 py-3.5">
            <dt className="text-[12.5px] text-[var(--subtle)]">{kpi.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {kpi.value}
            </dd>
          </Card>
        ))}
      </dl>

      <ul className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SHOTS.map((shot) => (
          <Card as="li" key={shot.src} className="overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-3.5">
              <h3 className="text-[14px] font-semibold">{shot.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                {shot.body}
              </p>
            </div>
            {/* Fixed-height window with a top-anchored image: the captures are
                tall full-page shots, and cropping them to a consistent band
                keeps the grid even without distorting anything. */}
            <div className="relative h-[260px] overflow-hidden bg-[var(--surface)] sm:h-[300px]">
              <Image
                src={shot.src}
                alt={shot.title}
                width={shot.width}
                height={shot.height}
                priority={shot.priority}
                sizes="(min-width: 1024px) 560px, 100vw"
                className="absolute top-0 left-0 w-full"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent"
                aria-hidden="true"
              />
            </div>
          </Card>
        ))}
      </ul>

      <Card className="mt-4 p-5">
        <MicroLabel>What the dashboard is actually for</MicroLabel>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--muted)]">
          The current-state analysis found that the manual process produces no
          data about itself — queue depth, ageing, re-route rate, and failure
          causes are not merely bad, they do not exist. Instrumenting the
          process was therefore a deliverable in its own right, not a side
          effect of automating it.
        </p>
      </Card>
    </Section>
  )
}
