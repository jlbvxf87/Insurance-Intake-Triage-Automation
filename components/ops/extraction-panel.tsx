import { cn } from '@/lib/utils/cn'
import { ValidationBadge } from '@/components/ui/badge'
import { CorrectExtraction } from '@/components/ops/correct-extraction'
import type { ExtractedPolicyData } from '@/lib/domain/types'

/**
 * Extracted policy data with per-field confidence (BR-018).
 *
 * The per-field figure is the point of this panel. An aggregate score tells a
 * reviewer that *something* was uncertain; the per-field breakdown tells them
 * which value to check first, which is the difference between re-reading the
 * document and confirming one number.
 */

const FIELDS: Array<{ key: keyof ExtractedPolicyData; label: string }> = [
  { key: 'namedInsured', label: 'Named insured' },
  { key: 'policyNumber', label: 'Policy number' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'policyType', label: 'Policy type' },
  { key: 'effectiveDate', label: 'Effective date' },
  { key: 'expirationDate', label: 'Expiration date' },
  { key: 'coverageAmount', label: 'Coverage amount' },
]

function formatValue(key: keyof ExtractedPolicyData, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'coverageAmount' && typeof value === 'number') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }
  return String(value)
}

export function ExtractionPanel({
  extraction,
  threshold,
  submissionId,
  editable,
}: {
  extraction: ExtractedPolicyData
  threshold: number
  submissionId: string
  editable: boolean
}) {
  return (
    <section
      aria-labelledby="extraction-heading"
      className="rounded-xl border border-[var(--border)] bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <div>
          <h2 id="extraction-heading" className="text-sm font-semibold">
            Extracted policy data
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--subtle)]">
            {extraction.provider === 'azure'
              ? 'Azure AI Document Intelligence'
              : 'Local fixture (demo mode)'}{' '}
            · aggregate {Math.round(extraction.extractionConfidence * 100)}% ·
            threshold {Math.round(threshold * 100)}%
          </p>
        </div>
        <ValidationBadge status={extraction.validationStatus} />
      </div>

      <dl className="divide-y divide-[var(--border)]">
        {FIELDS.map(({ key, label }) => {
          const confidence = extraction.fieldConfidence[key]
          const weak = confidence !== undefined && confidence < threshold
          const missing = extraction.missingFields.includes(key)

          return (
            <div
              key={key}
              className="grid grid-cols-[130px_1fr_auto] items-center gap-3 px-5 py-2.5"
            >
              <dt className="text-[13px] text-[var(--subtle)]">{label}</dt>
              <dd
                className={cn(
                  'min-w-0 truncate text-[13px]',
                  missing ? 'text-[var(--danger)] italic' : 'font-medium',
                )}
              >
                {missing ? 'Not found in document' : formatValue(key, extraction[key])}
              </dd>
              <dd className="text-right">
                {confidence === undefined ? (
                  <span className="text-[12px] text-[var(--subtle)]">—</span>
                ) : (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[12px] tabular-nums',
                      weak
                        ? 'bg-[#fdf8ec] text-[#6f4a06]'
                        : 'bg-[var(--surface)] text-[var(--muted)]',
                    )}
                  >
                    {Math.round(confidence * 100)}%
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      {extraction.missingFields.length > 0 && (
        <p className="border-t border-[var(--border)] bg-[#fdf2f1] px-5 py-3 text-[13px] text-[#8a1c16]">
          Required field{extraction.missingFields.length === 1 ? '' : 's'} not
          found: {extraction.missingFields.join(', ')}. The submission is held
          for intake correction.
        </p>
      )}

      {editable && (
        <CorrectExtraction submissionId={submissionId} extraction={extraction} />
      )}
    </section>
  )
}
