'use client'

import { useId, useRef, useState, type DragEvent } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { validateUpload } from '@/lib/domain/schemas'

/**
 * Document upload control (FR-002, FR-014).
 *
 * Drag-and-drop plus a real `<input type="file">` underneath — the input is
 * the control, the drop zone is an enhancement. That ordering matters: a
 * div-only drop zone is invisible to keyboard and screen-reader users.
 *
 * Client-side validation here is a courtesy that gives immediate feedback.
 * The server re-validates every upload (AC-007), because a browser check can
 * be bypassed.
 */

interface FileUploadProps {
  file: File | null
  onFileChange: (file: File | null) => void
  error?: string
  onValidationError: (message: string | null) => void
  maxBytes: number
  acceptedMimeTypes: readonly string[]
  disabled?: boolean
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

export function FileUpload({
  file,
  onFileChange,
  error,
  onValidationError,
  maxBytes,
  acceptedMimeTypes,
  disabled,
}: FileUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const accept = acceptedMimeTypes.join(',')
  const maxMb = Math.round(maxBytes / (1024 * 1024))

  function accept_(candidate: File | undefined | null) {
    if (!candidate) return
    const result = validateUpload(
      { name: candidate.name, type: candidate.type, size: candidate.size },
      { maxBytes, acceptedMimeTypes },
    )
    if (!result.ok) {
      onValidationError(result.message ?? 'This file cannot be used.')
      onFileChange(null)
      return
    }
    onValidationError(null)
    onFileChange(candidate)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    accept_(event.dataTransfer.files?.[0])
  }

  function clear() {
    onFileChange(null)
    onValidationError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const describedBy = error ? `${inputId}-error` : `${inputId}-hint`

  if (file) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Supporting document</span>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-[13px] text-[var(--subtle)]">
              {formatSize(file.size)} · ready to process
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Remove {file.name}</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        Supporting document{' '}
        <span className="font-normal text-[var(--subtle)]">(optional)</span>
      </label>

      <p id={`${inputId}-hint`} className="text-[13px] leading-snug text-[var(--subtle)]">
        A declarations page, ACORD form, or loss notice. PDF, PNG, JPEG, or
        TIFF, up to {maxMb} MB. Without a document the request is still
        processed using the details above.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border border-dashed px-4 py-6 text-center transition-colors duration-150',
          error
            ? 'border-[var(--danger)] bg-[#fdf2f1]'
            : isDragging
              ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
              : 'border-[var(--border-strong)] bg-[var(--surface)]',
          disabled && 'opacity-50',
        )}
      >
        <Upload
          className="mx-auto h-5 w-5 text-[var(--subtle)]"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-[var(--muted)]">
          Drag a file here, or{' '}
          <label
            htmlFor={inputId}
            className="cursor-pointer font-medium text-[var(--accent)] underline underline-offset-2 hover:no-underline"
          >
            browse
          </label>
        </p>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => accept_(e.target.files?.[0])}
          className="sr-only"
        />
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-[13px] leading-snug text-[var(--danger)]"
        >
          {error}
        </p>
      )}
    </div>
  )
}
