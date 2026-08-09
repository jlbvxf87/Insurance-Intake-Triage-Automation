import { ArrowRight, Play } from 'lucide-react'
import { GithubIcon } from './brand-icons'
import { Container } from './primitives'
import { FlowStrip } from './flow-strip'
import { SITE } from '@/lib/case-study/content'

/**
 * Hero (Phase 9).
 *
 * Two columns on desktop, copy first on mobile. Generous top padding and a
 * short measure — the hero's job is to be read in four seconds, so nothing
 * competes with the headline except the workflow strip that explains it.
 */
export function Hero() {
  return (
    <section className="border-b border-[var(--border)] bg-white">
      <Container>
        <div className="grid grid-cols-1 gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16 lg:py-24">
          {/* min-w-0 is load-bearing: without it the grid track expands to the
              min-content width of the scrolling flow strip beside it, and the
              whole page gains a horizontal scrollbar on mobile (NFR-013). */}
          <div className="min-w-0">
            <h1 className="text-[38px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance sm:text-[52px]">
              Insurance Intake &amp;
              <br className="hidden sm:block" /> Triage Automation
            </h1>

            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-[var(--muted)] text-pretty">
              {SITE.tagline}
            </p>

            <p className="mt-5 font-mono text-[13px] text-[var(--subtle)]">
              {SITE.metadata}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#workflow"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1a5fd0]"
              >
                View live workflow
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>

              <a
                href={SITE.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-white px-5 text-sm font-medium transition-colors hover:bg-[var(--surface)]"
              >
                <GithubIcon className="h-4 w-4" />
                Explore GitHub
              </a>

              <a
                href="#walkthrough"
                className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Watch the build
              </a>
            </div>

            <p className="mt-8 max-w-lg border-l-2 border-[var(--border-strong)] pl-4 text-[13px] leading-relaxed text-[var(--subtle)]">
              A self-directed case study. Not work performed for any insurer or
              broker, and no real customer data — every client, submission, and
              document is synthetic.
            </p>
          </div>

          <div className="min-w-0 lg:pl-4">
            <FlowStrip />
          </div>
        </div>
      </Container>
    </section>
  )
}
