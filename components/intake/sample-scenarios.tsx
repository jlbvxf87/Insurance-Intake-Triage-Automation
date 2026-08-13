'use client'

import { useRef, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import {
  SAMPLE_SCENARIOS,
  loadSampleDocument,
  pickSubmitter,
  scenarioValues,
  type SampleScenario,
} from '@/lib/intake/samples'
import { cn } from '@/lib/utils/cn'

/**
 * One-click scenarios that fill the form and attach a document.
 *
 * Deliberately not auto-running on page load. A submission that happens
 * without the visitor doing anything reads as a canned animation — the same
 * problem the workflow section on the case study page had. Pressing the button
 * and watching the run is the proof; removing that step removes the proof with
 * it.
 *
 * The fields populate visibly rather than being posted from a hidden payload,
 * so what gets submitted is what the visitor can see.
 */
export function SampleScenarios({
  onLoad,
  disabled,
}: {
  onLoad: (values: ReturnType<typeof scenarioValues>, document: File) => void
  disabled?: boolean
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Chosen on first use and then held for the rest of the visit.
   *
   * Not during render — a random value would differ between the server and
   * client markup. Not in an effect either, which is just setState-on-mount
   * wearing a hat. A ref filled on the first click is both stable and honest
   * about when the decision actually happens.
   */
  const submitterRef = useRef<ReturnType<typeof pickSubmitter> | null>(null)
  function submitter() {
    submitterRef.current ??= pickSubmitter()
    return submitterRef.current
  }

  async function choose(scenario: SampleScenario) {
    setError(null)
    setLoadingId(scenario.id)
    try {
      const document = await loadSampleDocument(scenario)
      onLoad(scenarioValues(scenario, submitter()), document)
    } catch {
      setError(
        'The sample document could not be loaded. You can still fill the form in by hand.',
      )
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <section
      aria-labelledby="samples-heading"
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <h2 id="samples-heading" className="text-sm font-semibold">
        Start from a sample
      </h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--muted)]">
        Fills the form and attaches a synthetic declarations page, so you can run
        the workflow without supplying a document of your own. Everything is
        editable afterwards.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_SCENARIOS.map((scenario) => {
          const loading = loadingId === scenario.id
          return (
            <div
              key={scenario.id}
              className="flex flex-col rounded-lg border border-[var(--border)] bg-white p-4"
            >
              <div className="flex items-start gap-2.5">
                <FileText
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--subtle)]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium">{scenario.label}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                    {scenario.description}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--subtle)]">
                    Watch: {scenario.watchFor}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => choose(scenario)}
                  disabled={disabled || loading}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--foreground)] px-3.5',
                    'text-[13px] font-medium text-white transition-colors hover:bg-[#242424]',
                    'disabled:cursor-not-allowed disabled:opacity-45',
                  )}
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {loading ? 'Loading…' : 'Use this one'}
                </button>

                {/* The document itself, for anyone who wants to see what the
                    extractor was actually given. */}
                <a
                  href={scenario.documentPath}
                  download={scenario.documentName}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  View the PDF
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      )}

      <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--subtle)]">
        Each visit uses a different submitter, so the first run is judged on its
        own merits. Press the same scenario a second time and the duplicate rule
        fires — same client, same type, same line of business, inside the
        window.
      </p>
    </section>
  )
}
