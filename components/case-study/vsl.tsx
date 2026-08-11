'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Clapperboard, Play } from 'lucide-react'
import { Card, Container, Eyebrow, MicroLabel } from './primitives'
import { VSL_TRANSCRIPT } from '@/lib/case-study/content'
import { cn } from '@/lib/utils/cn'

/**
 * Walkthrough video section (Phase 10).
 *
 * The walkthrough is recorded and shipping, so the poster state below is now
 * the fallback rather than the default. It is kept rather than deleted: if the
 * file is ever removed or replaced, the section degrades to an honest
 * placeholder instead of a broken player.
 *
 * The transcript beside the player carries the same words as the narration,
 * which is what makes the section useful to someone who cannot or will not
 * play video.
 */

const VIDEO_SRC = '/walkthrough.mp4'
const CAPTIONS_SRC = '/walkthrough.vtt'
const POSTER_SRC = '/walkthrough-poster.webp'

/**
 * Explicit switch rather than a runtime probe: a HEAD request on every page
 * load to discover whether a video exists is worse than one boolean.
 */
const VIDEO_AVAILABLE = true

export function Vsl() {
  const [playing, setPlaying] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  return (
    <section id="walkthrough" className="scroll-mt-20 bg-white py-14 sm:py-20">
      <Container>
        {/* The player column is the shorter of the two once the transcript has
            six entries in it, which left a slab of dead space under the video.
            Giving the video more width makes it taller, and centring the pair
            keeps the remaining difference balanced instead of pooling it all
            at the bottom of one column. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
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
                  poster={POSTER_SRC}
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
                <div className="relative aspect-video w-full bg-[radial-gradient(circle_at_50%_35%,#161b22,#0d1117)]">
                  {VIDEO_AVAILABLE ? (
                    <button
                      type="button"
                      onClick={() => setPlaying(true)}
                      className="group absolute inset-0 flex w-full items-center justify-center"
                      aria-label="Play the walkthrough"
                    >
                      {/* Full-bleed poster. It is already 16:9 and already
                          carries a face and a wordmark, so cropping it into a
                          corner would throw away the only frame of this video
                          that has to work as a still. */}
                      <Image
                        src={POSTER_SRC}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 55vw, 100vw"
                        priority={false}
                        className="object-cover"
                      />
                      {/* Scrim only where the control sits. A full overlay would
                          mute the poster; this keeps the label readable over
                          whatever happens to be in the lower left. */}
                      <span className="absolute inset-0 bg-gradient-to-t from-[#0d1117]/85 via-[#0d1117]/25 to-transparent" />

                      <span className="absolute inset-x-0 bottom-0 flex items-center gap-4 px-6 pb-6 sm:px-8 sm:pb-7">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/45 backdrop-blur-sm transition-colors group-hover:bg-black/65">
                          <Play className="ml-0.5 h-5 w-5 text-white" aria-hidden="true" />
                        </span>
                        <span className="text-left">
                          <span className="block text-sm font-medium text-white drop-shadow">
                            Play the walkthrough
                          </span>
                          <span className="mt-0.5 block text-[12.5px] text-white/75 drop-shadow">
                            Jaron Baston · 79 seconds
                          </span>
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex flex-col items-center gap-4 px-6 text-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--ink-border)] bg-[var(--ink-soft)]">
                          <Clapperboard className="h-5 w-5 text-[var(--ink-muted)]" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-medium text-white">
                          Not recorded yet
                        </p>
                        <p className="max-w-sm text-[13px] leading-relaxed text-[var(--ink-muted)]">
                          The player, captions, and transcript are wired and
                          ready. Rather than embed a placeholder that plays
                          nothing, this section says where it stands — the script
                          and shot list are below.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[var(--subtle)]">
              <span>79 seconds</span>
              <span>Captions included</span>
              <span>Full transcript alongside</span>
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
              {/* No timestamps. They were useful while the video was still a
                  shot list; now that the player is right there, a column of
                  times is furniture a reader has to skip past to reach the
                  words. The kind label stays — it says what you are looking
                  at, which the timing never did. */}
              {VSL_TRANSCRIPT.map((entry) => (
                <li key={entry.time} className="py-3 first:pt-0 last:pb-0">
                  <span className="inline-block rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                    {entry.kind}
                  </span>
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
