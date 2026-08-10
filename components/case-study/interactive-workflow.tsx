'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Play, RotateCcw, TriangleAlert } from 'lucide-react'
import { Container, Eyebrow } from './primitives'
import { Icon, type IconName } from './icon'
import { DEMO_NODES, DEMO_NODES_REVIEW, type DemoNode } from '@/lib/case-study/content'
import { usePrefersReducedMotion } from '@/lib/case-study/use-reduced-motion'
import { cn } from '@/lib/utils/cn'

/**
 * Interactive workflow demo (Phase 9A).
 *
 * An n8n-style run of the real pipeline. Two scenarios, because one of them is
 * the actual argument of this project: the clean path shows the automation
 * working, and the low-confidence path shows it declining to decide. A demo
 * that only ever showed the happy path would be making the opposite point.
 *
 * Animation rules, enforced rather than intended:
 *  - one active node at a time
 *  - 700 ms per step, 300 ms transitions
 *  - a border and a connector fill, nothing else
 *  - with reduced motion, the whole run resolves instantly and completely
 *
 * The node states are also readable without animation: completed nodes carry a
 * tick, escalating nodes carry a warning triangle. Motion is never the only
 * carrier of meaning.
 */

const STEP_MS = 700

const TONE_ACTIVE: Record<string, string> = {
  blue: 'border-[#3b82f6] bg-[#101a2e]',
  indigo: 'border-[#6366f1] bg-[#151633]',
  green: 'border-[#22c55e] bg-[#0e2018]',
  amber: 'border-[#f59e0b] bg-[#241c0c]',
  violet: 'border-[#a78bfa] bg-[#1c1533]',
  slate: 'border-[#94a3b8] bg-[#161b22]',
}

const TONE_DONE: Record<string, string> = {
  blue: 'border-[#1e3a6b]',
  indigo: 'border-[#2e3070]',
  green: 'border-[#1a4632]',
  amber: 'border-[#5c4413]',
  violet: 'border-[#3d2f70]',
  slate: 'border-[#39414d]',
}

const TONE_TEXT: Record<string, string> = {
  blue: 'text-[#7cb0ff]',
  indigo: 'text-[#9aa2ff]',
  green: 'text-[#6ee7a0]',
  amber: 'text-[#fbbf5c]',
  violet: 'text-[#c4b1fd]',
  slate: 'text-[#a9b4c2]',
}

type Scenario = 'routed' | 'review'

export function InteractiveWorkflow() {
  const reduced = usePrefersReducedMotion()
  const [scenario, setScenario] = useState<Scenario>('routed')
  const [step, setStep] = useState(-1)
  const [running, setRunning] = useState(false)
  const timer = useRef<number | null>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Array<HTMLLIElement | null>>([])
  const hasAutoRun = useRef(false)

  const nodes: DemoNode[] = scenario === 'routed' ? DEMO_NODES : DEMO_NODES_REVIEW
  const finished = step >= nodes.length - 1

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const run = useCallback(() => {
    clear()

    // Reduced motion: no stepping at all. The reader gets the completed run
    // immediately, with every node and every log line present.
    if (reduced) {
      setStep(nodes.length - 1)
      setRunning(false)
      return
    }

    setStep(0)
    setRunning(true)

    timer.current = window.setInterval(() => {
      setStep((current) => {
        if (current >= nodes.length - 1) {
          clear()
          setRunning(false)
          return current
        }
        return current + 1
      })
    }, STEP_MS)
  }, [clear, nodes.length, reduced])

  // Start when the section is first scrolled into view, not on page load —
  // an animation that has already finished before the reader arrives has
  // communicated nothing.
  useEffect(() => {
    const element = sectionRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAutoRun.current) {
            hasAutoRun.current = true
            run()
          }
        }
      },
      { threshold: 0.35 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [run])

  useEffect(() => clear, [clear])

  // Keep the active node in view. Eight nodes are wider than the canvas on
  // every viewport, so without this the run walks off the right edge and the
  // reader watches an empty strip. Scrolls the container directly rather than
  // using scrollIntoView, which would also move the page vertically.
  useEffect(() => {
    const canvas = canvasRef.current
    const node = nodeRefs.current[step]
    if (!canvas || !node) return

    canvas.scrollTo({
      left: node.offsetLeft - canvas.clientWidth / 2 + node.clientWidth / 2,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [step, reduced])

  function switchScenario(next: Scenario) {
    setScenario(next)
    setStep(-1)
    clear()
    setRunning(false)
    // Let the node list swap before re-running, so the first frame is the new
    // scenario rather than a mix of both.
    window.setTimeout(run, 60)
  }

  const activeNode = step >= 0 ? nodes[Math.min(step, nodes.length - 1)] : null

  return (
    <section
      id="workflow"
      ref={sectionRef}
      className="scroll-mt-20 bg-[var(--ink)] py-14 text-[var(--ink-foreground)] sm:py-20"
    >
      <Container>
        <div className="flex flex-col gap-3">
          <Eyebrow dark>Interactive workflow</Eyebrow>
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance text-white sm:text-[32px] sm:leading-[1.15]">
            Watch one submission move through the pipeline
          </h2>
          <p className="max-w-2xl leading-relaxed text-[var(--ink-muted)] text-pretty">
            The same eight steps the orchestrator actually runs. Switch
            scenarios to see the difference that matters: a clean submission
            routes itself, and a low-confidence one declines to.
          </p>
        </div>

        {/* Controls */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Scenario"
            className="inline-flex rounded-lg border border-[var(--ink-border)] bg-[var(--ink-soft)] p-1"
          >
            {(
              [
                ['routed', 'Clean submission'],
                ['review', 'Low confidence'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={scenario === value}
                onClick={() => switchScenario(value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  scenario === value
                    ? 'bg-[#21262d] text-white'
                    : 'text-[var(--ink-muted)] hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={run}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-soft)] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#21262d]"
          >
            {finished || step === -1 ? (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {running ? 'Running…' : finished ? 'Run again' : 'Run'}
          </button>

          <span className="font-mono text-[12px] text-[#6b7785]">
            flows / insurance-intake-triage
          </span>
        </div>

        {/* Node canvas */}
        <div className="mt-6 overflow-hidden rounded-[14px] border border-[var(--ink-border)] bg-[#0b0f16]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--ink-border)] px-4 py-2.5">
            <span className="font-mono text-[12px] text-[#6b7785]">
              Insurance Submission Intake &amp; Triage
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium',
                finished
                  ? scenario === 'review'
                    ? 'bg-[#241c0c] text-[#fbbf5c]'
                    : 'bg-[#0e2018] text-[#6ee7a0]'
                  : 'bg-[#161b22] text-[var(--ink-muted)]',
              )}
            >
              {finished
                ? scenario === 'review'
                  ? 'Needs review'
                  : 'Succeeded'
                : running
                  ? 'Running'
                  : 'Idle'}
            </span>
          </div>

          <div ref={canvasRef} className="overflow-x-auto px-4 py-5">
            <ol className="flex min-w-max items-stretch gap-0">
              {nodes.map((node, index) => {
                const done = step > index
                const active = step === index
                const escalates = node.status === 'review'

                return (
                  <li
                    key={node.id}
                    ref={(el) => {
                      nodeRefs.current[index] = el
                    }}
                    className="flex items-center"
                  >
                    <div
                      className={cn(
                        'flex min-h-[74px] w-[164px] flex-col justify-center rounded-xl border px-3 py-2.5 transition-all duration-300 ease-out',
                        active
                          ? TONE_ACTIVE[node.tone]
                          : done
                            ? cn(TONE_DONE[node.tone], 'bg-[#0f141c]')
                            : 'border-[#1c222c] bg-[#0d1219]',
                        !active && !done && 'opacity-45',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            'mt-px transition-colors duration-300',
                            active || done ? TONE_TEXT[node.tone] : 'text-[#4d5764]',
                          )}
                        >
                          <Icon name={node.icon as IconName} className="h-4 w-4 shrink-0" />
                        </span>
                        <span className="text-[12.5px] leading-tight font-semibold text-balance text-white">
                          {node.label}
                        </span>
                        {done && !escalates && (
                          <Check className="mt-px ml-auto h-3.5 w-3.5 shrink-0 text-[#6ee7a0]" aria-hidden="true" />
                        )}
                        {done && escalates && (
                          <TriangleAlert className="mt-px ml-auto h-3.5 w-3.5 shrink-0 text-[#fbbf5c]" aria-hidden="true" />
                        )}
                      </div>
                      <p className="mt-1 text-[11.5px] leading-tight text-balance text-[var(--ink-muted)]">
                        {node.sublabel}
                      </p>
                    </div>

                    {index < nodes.length - 1 && (
                      <ChevronRight
                        className={cn(
                          'mx-1 h-4 w-4 shrink-0 transition-colors duration-300',
                          step > index ? 'text-[#3d4753]' : 'text-[#1c222c]',
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Log panel */}
          <div className="border-t border-[var(--ink-border)] bg-[#0d1219] px-4 py-4">
            <p className="font-mono text-[11px] tracking-[0.08em] text-[#6b7785] uppercase">
              Run trace
            </p>

            <div
              className="mt-2.5 min-h-[76px] font-mono text-[12.5px] leading-[1.75]"
              aria-live="polite"
            >
              {activeNode ? (
                <>
                  <p className="text-white">
                    <span className="text-[#6b7785]">
                      {String(step + 1).padStart(2, '0')} ·{' '}
                    </span>
                    {activeNode.label}
                  </p>
                  {activeNode.detail.map((line) => (
                    <p key={line} className="text-[#8b949e]">
                      {'   '}
                      {line}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-[#4d5764]">Waiting to run…</p>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          {scenario === 'routed' ? (
            <>
              This is a scripted replay, not a live run — the values come from
              the fixture adapter and the same business rules the test suite
              asserts against. To put a real document through the running
              system, use{' '}
              <Link
                href="/intake"
                className="font-medium text-[#9aa2ff] underline underline-offset-2 hover:text-white"
              >
                the intake form
              </Link>
              , then watch it land in{' '}
              <Link
                href="/ops"
                className="font-medium text-[#9aa2ff] underline underline-offset-2 hover:text-white"
              >
                the dashboard
              </Link>
              .
            </>
          ) : (
            <>
              The routing rule still resolves — Workers Compensation still maps
              to the WC Team. The confidence gate is what stops the submission,
              not the AI. That separation is the whole design.
            </>
          )}
        </p>
      </Container>
    </section>
  )
}
