import { Card, Section, SectionHeader } from './primitives'
import { IconTile, type IconName, type Tone } from './icon'
import { BUILD_PHASES, WHAT_I_BUILT } from '@/lib/case-study/content'

/** What I built + the build process / dev log (Phase 9). */
export function WhatIBuilt() {
  return (
    <Section id="build" tone="light">
      <SectionHeader
        eyebrow="Build process"
        title="Nine phases, in order"
        lede="Process analysis before data model, data model before code, code before the page you are reading. Each phase ended with a commit stating what was built, what was verified, and what was still broken."
      />

      <ul className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WHAT_I_BUILT.map((item) => (
          <Card as="li" key={item.title} interactive className="flex items-start gap-3 p-4">
            <IconTile name={item.icon as IconName} tone={item.tone as Tone} size="md" />
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold">{item.title}</h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                {item.body}
              </p>
            </div>
          </Card>
        ))}
      </ul>

      <ol className="mt-8 border-l border-[var(--border)] pl-5 sm:pl-6">
        {BUILD_PHASES.map((phase) => (
          <li key={phase.phase} className="relative pb-6 last:pb-0">
            <span
              className="absolute top-[5px] -left-[25px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[var(--border)] bg-white font-mono text-[11px] font-semibold text-[var(--muted)] sm:-left-[29px]"
              aria-hidden="true"
            >
              {phase.phase}
            </span>
            <h3 className="text-[14.5px] font-semibold">
              <span className="sr-only">Phase {phase.phase}: </span>
              {phase.title}
            </h3>
            <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-[var(--muted)] text-pretty">
              {phase.body}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
