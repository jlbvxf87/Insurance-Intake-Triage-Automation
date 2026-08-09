import { Card, Section } from './primitives'
import { IconTile, type IconName, type Tone } from './icon'
import { PILLARS } from '@/lib/case-study/content'

/** Problem / System / Outcome (Phase 9, section 4). */
export function Pillars() {
  return (
    <Section id="system" tone="light" spacing="tight">
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PILLARS.map((pillar) => (
          <Card as="li" key={pillar.id} className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <IconTile
                name={pillar.icon as IconName}
                tone={pillar.tone as Tone}
                size="sm"
              />
              <h3 className="text-[15px] font-semibold">{pillar.title}</h3>
            </div>
            <p className="mt-3.5 text-[14px] leading-relaxed text-[var(--muted)] text-pretty">
              {pillar.body}
            </p>
          </Card>
        ))}
      </ul>
    </Section>
  )
}
