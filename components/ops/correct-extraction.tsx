'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, PencilLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import type { ExtractedPolicyData } from '@/lib/domain/types'

/**
 * Correct extracted policy data (FR-011).
 *
 * Pre-filled with what the model produced rather than starting blank: a
 * reviewer confirming four correct fields and fixing one should not have to
 * retype the four. That is the whole point of retaining low-confidence values
 * instead of discarding them.
 */

const FIELDS = [
  { key: 'namedInsured', label: 'Named insured', type: 'text' },
  { key: 'policyNumber', label: 'Policy number', type: 'text' },
  { key: 'carrier', label: 'Carrier', type: 'text' },
  { key: 'effectiveDate', label: 'Effective date', type: 'date' },
  { key: 'expirationDate', label: 'Expiration date', type: 'date' },
  { key: 'coverageAmount', label: 'Coverage amount', type: 'number' },
] as const

type FieldKey = (typeof FIELDS)[number]['key']

export function CorrectExtraction({
  submissionId,
  extraction,
}: {
  submissionId: string
  extraction: ExtractedPolicyData
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<FieldKey, string>>(() =>
    Object.fromEntries(
      FIELDS.map((f) => [f.key, extraction[f.key] === null ? '' : String(extraction[f.key])]),
    ) as Record<FieldKey, string>,
  )

  async function save() {
    setSaving(true)
    setError(null)

    const corrections: Record<string, string | number> = {}
    for (const field of FIELDS) {
      const value = values[field.key].trim()
      if (value === '') continue
      corrections[field.key] =
        field.type === 'number' ? Number(value) : value
    }

    try {
      const response = await fetch(`/api/submissions/${submissionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'correct-extraction', corrections },
          actor: 'operations',
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        setError(payload?.issues?.join(' ') ?? payload?.message ?? 'The correction could not be saved.')
        return
      }

      setOpen(false)
      router.refresh()
    } catch {
      setError('The correction could not be sent. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div className="border-t border-[var(--border)] px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
          Correct extracted values
        </button>
        <p className="mt-1 text-[12px] text-[var(--subtle)]">
          Marks the extraction verified. Does not release the submission — that
          is a separate action.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-[var(--border)] px-5 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Correct extracted values</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-[var(--subtle)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Cancel</span>
        </button>
      </div>

      {error && (
        <div className="mt-3">
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label
              htmlFor={`correct-${field.key}`}
              className="text-[12px] font-medium text-[var(--muted)]"
            >
              {field.label}
            </label>
            <input
              id={`correct-${field.key}`}
              type={field.type}
              value={values[field.key]}
              disabled={saving}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className="h-9 rounded-lg border border-[var(--border-strong)] bg-white px-2.5 text-[13px] hover:border-[#bdbdbd] focus:border-[var(--accent)] disabled:bg-[var(--surface)]"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save corrections
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
      </div>

      <p className="mt-3 text-[12px] leading-snug text-[var(--subtle)]">
        Model confidence is left as recorded. It documents what the extraction
        reported, and overwriting it would remove the evidence for whether a
        custom-trained model is worth the effort.
      </p>
    </div>
  )
}
