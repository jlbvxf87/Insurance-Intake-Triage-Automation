'use client'

import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Form field primitives (NFR-009).
 *
 * Every control here is wired the same way:
 *  - a real `<label htmlFor>`, never a placeholder standing in for a label
 *  - `aria-invalid` when the field has an error
 *  - `aria-describedby` pointing at the hint and the error, so a screen reader
 *    announces *why* a field was rejected rather than only that it was
 *  - errors in `role="alert"`, so they are announced when they appear
 */

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

export function Field({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-[var(--foreground)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--danger)]" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>

      {hint && (
        <p id={hintId} className="text-[13px] leading-snug text-[var(--subtle)]">
          {hint}
        </p>
      )}

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-[13px] leading-snug text-[var(--danger)]"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

const controlBase =
  'w-full rounded-lg border bg-white px-3 text-sm text-[var(--foreground)] ' +
  'transition-colors duration-150 placeholder:text-[#a8a8a8] ' +
  'disabled:cursor-not-allowed disabled:bg-[var(--surface)] disabled:text-[var(--subtle)]'

const controlState = (invalid: boolean) =>
  invalid
    ? 'border-[var(--danger)] focus:border-[var(--danger)]'
    : 'border-[var(--border-strong)] hover:border-[#bdbdbd] focus:border-[var(--accent)]'

export function TextInput({
  invalid = false,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(controlBase, controlState(invalid), 'h-10', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export function Select({
  invalid = false,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        controlBase,
        controlState(invalid),
        'h-10 appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'none\' stroke=\'%235c5c5c\' stroke-width=\'1.5\' d=\'M1 1.5 6 6.5 11 1.5\'/%3E%3C/svg%3E")] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({
  invalid = false,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(controlBase, controlState(invalid), 'resize-y py-2.5', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}
