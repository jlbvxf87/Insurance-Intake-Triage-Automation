import { ArrowUpRight, Mail } from 'lucide-react'
import { GithubIcon, LinkedinIcon } from './brand-icons'
import { Container } from './primitives'
import { SITE } from '@/lib/case-study/content'

const REPO_HIGHLIGHTS = [
  ['docs/', 'Business case, current and future state, requirements, acceptance criteria, test plan'],
  ['dataverse/', 'Table schema with option-set values, keys, and delete behaviour'],
  ['power-automate/', 'Flow design, expressions paired with their TypeScript equivalents, error handling'],
  ['lib/workflow/', 'The orchestrator, business rules, duplicate detection, review actions'],
  ['tests/', '188 tests across six suites'],
]

/** GitHub CTA + about/resume CTA (Phase 9, sections 17–18). */
export function Closing() {
  return (
    <>
      <section className="scroll-mt-20 bg-[var(--ink)] py-14 text-[var(--ink-foreground)] sm:py-20">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-balance text-white sm:text-[32px] sm:leading-[1.15]">
                Read the repository
              </h2>
              <p className="mt-3 max-w-lg leading-relaxed text-[var(--ink-muted)] text-pretty">
                Ten commits, one per phase, each recording what was built, what
                was verified, and what was still broken. The commit messages are
                part of the artifact — they are where the reasoning lives.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={SITE.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[#e6edf3]"
                >
                  <GithubIcon className="h-4 w-4" />
                  View on GitHub
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <a
                  href={`${SITE.github}/blob/main/docs/test-plan.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-soft)] px-5 text-sm font-medium text-white transition-colors hover:bg-[#21262d]"
                >
                  Read the test plan
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            <dl className="divide-y divide-[var(--ink-border)] overflow-hidden rounded-[14px] border border-[var(--ink-border)] bg-[var(--ink-soft)]">
              {REPO_HIGHLIGHTS.map(([path, description]) => (
                <div key={path} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[150px_1fr] sm:gap-4">
                  <dt className="font-mono text-[12.5px] text-[#9aa2ff]">{path}</dt>
                  <dd className="text-[12.5px] leading-relaxed text-[var(--ink-muted)]">
                    {description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      <section id="about" className="scroll-mt-20 bg-white py-14 sm:py-20">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-[32px] sm:leading-[1.15]">
                How I approach business applications work
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-[var(--muted)] text-pretty">
                Understand the process before choosing the technology. Structure
                the data so the rules have something reliable to stand on.
                Automate what is genuinely repeatable. Keep people in the places
                where judgement is required — and give those places a queue, a
                stated reason, and an owner, so escalation is a designed outcome
                rather than a breakdown.
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-[var(--muted)] text-pretty">
                Then document it — requirements, acceptance criteria, and test
                cases — so the result can be maintained and improved by someone
                who was not there when it was built.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={SITE.resume}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1a5fd0]"
                >
                  Resume
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <a
                  href={SITE.email}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-white px-5 text-sm font-medium transition-colors hover:bg-[var(--surface)]"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Get in touch
                </a>
              </div>
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--subtle)] uppercase">
                Resume entry
              </p>
              <h3 className="mt-3 text-[15px] font-semibold">
                Insurance Submission Intelligence &amp; Triage — Power Platform / Azure AI
              </h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--muted)]">
                Designed and implemented an insurance intake workflow
                integrating Azure Document Intelligence, structured CRM data,
                duplicate detection, business-rule routing, Power Automate,
                human-review thresholds, and workflow logging. Produced
                functional requirements, relational data models, current and
                future-state process documentation, acceptance criteria, and
                test cases.
              </p>
              <p className="mt-4 border-t border-[var(--border)] pt-4 text-[12.5px] leading-relaxed text-[var(--subtle)]">
                Self-directed case study. No proprietary data, no client
                engagement, no real policy information — every record in the
                system is synthetic.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}

export function SiteFooter() {
  const links = [
    { href: SITE.github, label: 'GitHub', icon: GithubIcon },
    { href: SITE.linkedin, label: 'LinkedIn', icon: LinkedinIcon },
    { href: SITE.email, label: 'Email', icon: Mail },
  ]

  return (
    <footer className="border-t border-[var(--border)] bg-white py-8">
      <Container>
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-[13px] text-[var(--subtle)]">
            © 2026 {SITE.author}
          </p>
          <p className="text-[13px] text-[var(--subtle)]">
            Built as a business applications portfolio case study.
          </p>
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="inline-flex rounded-md p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                >
                  <link.icon className="h-[18px] w-[18px]" />
                  <span className="sr-only">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  )
}
