'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { IconTile, type IconName, type Tone } from './icon'
import { HERO_NODES } from '@/lib/case-study/content'
import { cn } from '@/lib/utils/cn'
import { usePrefersReducedMotion } from '@/lib/case-study/use-reduced-motion'

/**
 * Hero workflow strip.
 *
 * A single highlight travels the chain once every few seconds. It is
 * decoration with a job: it shows the reader the shape of the pipeline before
 * they have read a word of body copy.
 *
 * **Layout.** Six nodes in one row need roughly 560px. The hero's right column
 * only has that from `xl` up, so below that the strip reflows to a 3×2 grid
 * rather than scrolling. An earlier version kept the single row inside an
 * `overflow-x-auto` wrapper — which pushed the grid track past the viewport
 * and gave the whole page a horizontal scrollbar at 390px, 768px, and 1024px.
 * Reflowing is the fix; the scroll container was treating the symptom.
 *
 * **Motion.** One node active at a time, a ring and a slight lift, 400ms
 * transitions, and nothing at all under `prefers-reduced-motion`. The strip is
 * fully legible at rest, so the animation never carries information alone.
 */
export function FlowStrip() {
  const reduced = usePrefersReducedMotion()
  const [active, setActive] = useState(-1)

  useEffect(() => {
    if (reduced) return

    let index = -1
    const tick = window.setInterval(() => {
      index = index + 1 > HERO_NODES.length ? 0 : index + 1
      setActive(index >= HERO_NODES.length ? -1 : index)
    }, 900)

    return () => window.clearInterval(tick)
  }, [reduced])

  return (
    <ol
      className="grid grid-cols-3 gap-x-2 gap-y-6 xl:flex xl:items-start xl:justify-between xl:gap-0"
      aria-hidden="true"
    >
      {HERO_NODES.map((node, index) => (
        <li key={node.id} className="flex min-w-0 items-start xl:shrink-0">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center xl:w-[76px] xl:flex-none">
            <span
              className={cn(
                'rounded-[16px] p-[3px] transition-all duration-[400ms] ease-out',
                active === index
                  ? 'bg-[var(--accent-soft)] ring-1 ring-[#c7dbfb]'
                  : 'bg-transparent ring-1 ring-transparent',
              )}
            >
              <IconTile
                name={node.icon as IconName}
                tone={node.tone as Tone}
                size="lg"
                className={cn(
                  'transition-transform duration-[400ms] ease-out',
                  active === index && !reduced && 'scale-[1.04]',
                )}
              />
            </span>
            <span className="text-[12.5px] leading-tight font-semibold text-balance text-[var(--foreground)]">
              {node.label}
            </span>
            <span className="text-[11px] leading-tight text-balance text-[var(--subtle)]">
              {node.caption}
            </span>
          </div>

          {index < HERO_NODES.length - 1 && (
            <ChevronRight
              className={cn(
                'mt-[19px] hidden h-3.5 w-3.5 shrink-0 transition-colors duration-[400ms] xl:mx-1 xl:block',
                active === index ? 'text-[var(--accent)]' : 'text-[#c4c9d2]',
              )}
            />
          )}
        </li>
      ))}
    </ol>
  )
}
