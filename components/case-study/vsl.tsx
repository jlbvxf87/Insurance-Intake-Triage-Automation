'use client'

import { useState } from 'react'
import { ChevronDown, Clapperboard, Play } from 'lucide-react'
import { Card, Container, Eyebrow, MicroLabel } from './primitives'
import { VSL_TRANSCRIPT } from '@/lib/case-study/content'
import { cn } from '@/lib/utils/cn'

/**
 * Walkthrough video section (Phase 10).
 *
 * The player is wired but the file is not recorded yet, so the component ships
 * in its poster state and says so. The alternative — an embed pointing at
 * nothing, or a fake play button — would be the one thing a page about
 * verifiable claims cannot afford.
 *
 * Dropping `public/walkthrough.mp4` (plus `walkthrough.vtt` for captions) is
 * the only change needed to go live.
 */

const VIDEO_SRC = '/walkthrough.mp4'
const CAPTIONS_SRC = '/walkthrough.vtt'

/**
 * Flip to `true` once the file exists. Kept as an explicit switch rather than
 * a runtime probe: a HEAD request on every page load to discover whether a
 * video exists is worse than one boolean.
 */
const VIDEO_AVAILABLE = false

export function Vsl() {
  const [playing, setPlaying] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  return (
    <section id="walkthrough" className="scroll-mt-20 bg-white py-14 sm:py-20">
      <Container>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <Eyebrow>Walkthrough</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-[32px] sm:leading-[1.15]">
              A 90-second tour of the system
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-[var(--muted)] text-pretty">
              Intake, extraction, the data model, the duplicate check, routing,
              the exception path, and the dashboard — in the order they run.
            </p>

            <div className="mt-6 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--ink)]">
              {VIDEO_AVAILABLE && playing ? (
                <video
                  className="aspect-video w-full"
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                >
                  <source src={VIDEO_SRC} type="video/mp4" />
                  <track
                    kind="captions"
                    src={CAPTIONS_SRC}
                    srcLang="en"
                    label="English"
                    default
                  />
                  Your browser does not support embedded video. The transcript
                  below covers the same material.
                </video>
              ) : (
                <div className="relative flex aspect-video w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#161b22,#0d1117)]">
                  <div className="flex flex-col items-center gap-4 px-6 text-center">
                    <span
                      className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-full border border-[var(--ink-border)] bg-[var(--ink-soft)]',
                        VIDEO_AVAILABLE && 'cursor-pointer hover:bg-[#21262d]',
                      )}
                    >
                      {VIDEO_AVAILABLE ? (
                        <Play className="ml-0.5 h-5 w-5 text-white" aria-hidden="true" />
                      ) : (
                        <Clapperboard className="h-5 w-5 text-[var(--ink-muted)]" aria-hidden="true" />
                      )}
                    </span>

                    {VIDEO_AVAILABLE ? (
                      <button
                        type="button"
                        onClick={() => setPlaying(true)}
                        className="text-sm font-medium text-white"
                      >
                        Play the walkthrough
                      </button>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-white">
                          Not recorded yet
                        </p>
                        <p className="max-w-sm text-[13px] leading-relaxed text-[var(--ink-muted)]">
                          The player, captions, and transcript are wired and
                          ready. Rather than embed a placeholder that plays
                          nothing, this section says where it stands — the script
                          and shot list are below.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[var(--subtle)]">
              <span>Target length 80–90s</span>
              <span>Captions included</span>
              <span>Full transcript below</span>
            </div>
          </div>

          <Card className="flex flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <MicroLabel>Script</MicroLabel>
              <button
                type="button"
                onClick={() => setTranscriptOpen((v) => !v)}
                aria-expanded={transcriptOpen}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] lg:hidden"
              >
                {transcriptOpen ? 'Hide' : 'Show'}
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    transcriptOpen && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>
            </div>

            <ol
              className={cn(
                'mt-4 flex-col divide-y divide-[var(--border)] lg:flex',
                transcriptOpen ? 'flex' : 'hidden',
              )}
            >
              {VSL_TRANSCRIPT.map((entry) => (
                <li key={entry.time} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[11.5px] text-[var(--subtle)] tabular-nums">
                      {entry.time}
                    </span>
                    <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                      {entry.kind}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--muted)] text-pretty">
                    {entry.text}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </Container>
    </section>
  )
}
