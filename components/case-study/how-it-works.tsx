import { Card, Section, SectionHeader } from './primitives'
import { IconTile, type IconName } from './icon'
import { HOW_IT_WORKS } from '@/lib/case-study/content'

/** How it works — six numbered steps (Phase 9). */
export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="plain">
      <SectionHeader
        eyebrow="Process"
        title="How it works"
        lede="Six steps. The first five are mechanical and automated. The sixth is the one a person is kept for."
      />

      <ol className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HOW_IT_WORKS.map((item) => (
          <Card as="li" key={item.step} interactive className="p-5">
            <div className="flex items-start justify-between gap-3">
              <IconTile name={item.icon as IconName} tone="blue" size="md" />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-soft)] font-mono text-[11px] font-semibold text-[var(--accent)]">
                {item.step}
              </span>
            </div>
            <h3 className="mt-3.5 text-[15px] font-semibold">{item.title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--muted)] text-pretty">
              {item.body}
            </p>
          </Card>
        ))}
      </ol>
    </Section>
  )
}
