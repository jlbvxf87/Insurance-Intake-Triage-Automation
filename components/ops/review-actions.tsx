'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import type { SubmissionStatus } from '@/lib/domain/enums'

/**
 * Review actions available to an operator (FR-010, FR-011).
 *
 * Which actions appear is derived from the submission's current status via the
 * same transition table the server enforces, so the UI never offers a move the
 * API will reject. The server still validates — this is a courtesy, not the
 * control.
 */

type ActionType =
  | 'release'
  | 'dismiss-duplicate'
  | 'confirm-duplicate'
  | 'close'

const LABELS: Record<ActionType, { label: string; description: string }> = {
  release: {
    label: 'Release to team',
    description: 'Applies the routing rule, clears the review flags, and notifies the submitter.',
  },
  'dismiss-duplicate': {
    label: 'Not a duplicate',
    description: 'Clears the duplicate flag and routes the submission normally.',
  },
  'confirm-duplicate': {
    label: 'Confirm duplicate',
    description: 'Closes this submission. The duplicate reason is retained on the record.',
  },
  close: {
    label: 'Close without routing',
    description: 'Marks the submission resolved with no team assignment.',
  },
}

function availableActions(status: SubmissionStatus): ActionType[] {
  switch (status) {
    case 'In Review':
      return ['release', 'close']
    case 'Duplicate':
      return ['dismiss-duplicate', 'confirm-duplicate']
    case 'Exception':
      return ['release', 'close']
    case 'Routed':
      return ['close']
    default:
      return []
  }
}

export function ReviewActions({
  submissionId,
  status,
}: {
  submissionId: string
  status: SubmissionStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<ActionType | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const actions = availableActions(status)
  if (actions.length === 0) {
    return (
      <p className="text-[13px] text-[var(--subtle)]">
        This submission is closed. No further action is available.
      </p>
    )
  }

  async function act(type: ActionType) {
    setPending(type)
    setError(null)

    try {
      const response = await fetch(`/api/submissions/${submissionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type, note: note.trim() || undefined },
          actor: 'operations',
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        setError(payload?.message ?? 'The action could not be completed.')
        return
      }

      setNote('')
      router.refresh()
    } catch {
      setError('The action could not be sent. Check your connection and try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Callout tone="danger" role="alert">
          {error}
        </Callout>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-note" className="text-[13px] font-medium">
          Note <span className="font-normal text-[var(--subtle)]">(optional)</span>
        </label>
        <p id="review-note-hint" className="text-[12px] text-[var(--subtle)]">
          Recorded on the automation log with your action.
        </p>
        <textarea
          id="review-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-describedby="review-note-hint"
          placeholder="Policy number confirmed against the carrier portal."
          className="w-full resize-y rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-sm placeholder:text-[#a8a8a8] hover:border-[#bdbdbd] focus:border-[var(--accent)]"
        />
      </div>

      <ul className="flex flex-col gap-2.5">
        {actions.map((type) => (
          <li key={type} className="flex flex-col gap-1">
            <Button
              variant={type === 'release' || type === 'dismiss-duplicate' ? 'primary' : 'secondary'}
              size="sm"
              disabled={pending !== null}
              onClick={() => act(type)}
              className="w-full sm:w-auto"
            >
              {pending === type && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              {LABELS[type].label}
            </Button>
            <p className="text-[12px] leading-snug text-[var(--subtle)]">
              {LABELS[type].description}
            </p>
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="sr-only">
        {pending ? `Applying ${LABELS[pending].label}.` : ''}
      </p>
    </div>
  )
}
