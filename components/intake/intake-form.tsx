'use client'

import { useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Field, Select, Textarea, TextInput } from '@/components/ui/field'
import { FileUpload } from '@/components/intake/file-upload'
import { SubmissionReceipt } from '@/components/intake/submission-receipt'
import { SampleScenarios } from '@/components/intake/sample-scenarios'
import type { SampleScenario } from '@/lib/intake/samples'
import {
  defaultAcceptedMimeTypes,
  emptyIntakeForm,
  intakeFormSchema,
  toFieldErrors,
  type FieldErrors,
  type SubmissionResponse,
} from '@/lib/domain/schemas'
import { LINES_OF_BUSINESS, SUBMISSION_TYPES } from '@/lib/domain/enums'
import type { PublicConfig } from '@/lib/config'

/**
 * Public intake form (FR-001, FR-013, NFR-009, NFR-010).
 *
 * Validation runs against the *same* Zod schema the server uses, so the two
 * cannot drift. The client copy exists for immediate feedback; the server copy
 * is the enforcement.
 *
 * The document is posted to this application's own API route. It is never sent
 * from the browser to Azure or any other third party (NFR-003).
 */

type Values = Record<keyof typeof emptyIntakeForm, string>

export function IntakeForm({ config }: { config: PublicConfig }) {
  const [values, setValues] = useState<Values>({ ...emptyIntakeForm })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmissionResponse | null>(null)

  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function set(field: keyof Values, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    // Clear the error as soon as the user starts fixing the field. Leaving it
    // visible while they type reads as the form arguing with them.
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  function loadScenario(scenario: SampleScenario, document: File) {
    setValues({ ...scenario.values })
    setFile(document)
    setErrors({})
    setFileError(null)
    setFormError(null)
  }

  function focusFirstError(fieldErrors: FieldErrors) {
    const first = Object.keys(fieldErrors)[0]
    if (!first) return
    const element = formRef.current?.querySelector<HTMLElement>(`#field-${first}`)
    element?.focus()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const parsed = intakeFormSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error)
      setErrors(fieldErrors)
      focusFirstError(fieldErrors)
      return
    }

    setErrors({})
    setStatus('submitting')

    try {
      const body = new FormData()
      for (const [key, value] of Object.entries(parsed.data)) {
        body.append(key, String(value))
      }
      if (file) body.append('document', file)

      const response = await fetch('/api/submissions', { method: 'POST', body })
      const payload = await response.json()

      if (!response.ok) {
        if (payload?.fieldErrors) {
          setErrors(payload.fieldErrors)
          if (payload.fieldErrors.document) setFileError(payload.fieldErrors.document)
          focusFirstError(payload.fieldErrors)
        }
        setFormError(
          payload?.message ??
            'The submission could not be accepted. Check the highlighted fields and try again.',
        )
        errorSummaryRef.current?.focus()
        return
      }

      setResult(payload as SubmissionResponse)
    } catch {
      setFormError(
        'The submission could not be sent. Check your connection and try again — nothing has been recorded.',
      )
      errorSummaryRef.current?.focus()
    } finally {
      setStatus('idle')
    }
  }

  function reset() {
    setValues({ ...emptyIntakeForm })
    setErrors({})
    setFile(null)
    setFileError(null)
    setFormError(null)
    setResult(null)
  }

  if (result) {
    return <SubmissionReceipt result={result} onSubmitAnother={reset} />
  }

  const submitting = status === 'submitting'

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      {formError && (
        <div ref={errorSummaryRef} tabIndex={-1}>
          <Callout tone="danger" role="alert" title="Submission not accepted">
            {formError}
          </Callout>
        </div>
      )}

      <SampleScenarios onLoad={loadScenario} disabled={submitting} />

      {/* Contact -------------------------------------------------------- */}
      <fieldset className="flex flex-col gap-5" disabled={submitting}>
        <legend className="mb-1 text-[13px] font-semibold tracking-widest text-[var(--subtle)] uppercase">
          Contact
        </legend>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="field-clientName" label="Full name" error={errors.clientName} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="clientName"
                autoComplete="name"
                value={values.clientName}
                onChange={(e) => set('clientName', e.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder="Dana Whitfield"
              />
            )}
          </Field>

          <Field id="field-companyName" label="Company" error={errors.companyName} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="companyName"
                autoComplete="organization"
                value={values.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder="ACME Trucking LLC"
              />
            )}
          </Field>

          <Field
            id="field-email"
            label="Email"
            error={errors.email}
            hint="Used to match your existing client record."
            required
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder="dispatch@company.example"
              />
            )}
          </Field>

          <Field id="field-phone" label="Phone" error={errors.phone} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder="(816) 555-0142"
              />
            )}
          </Field>
        </div>
      </fieldset>

      {/* Request -------------------------------------------------------- */}
      <fieldset className="flex flex-col gap-5" disabled={submitting}>
        <legend className="mb-1 text-[13px] font-semibold tracking-widest text-[var(--subtle)] uppercase">
          Request
        </legend>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            id="field-submissionType"
            label="Request type"
            error={errors.submissionType}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="submissionType"
                value={values.submissionType}
                onChange={(e) => set('submissionType', e.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
              >
                <option value="">Select…</option>
                {SUBMISSION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            id="field-lineOfBusiness"
            label="Line of business"
            error={errors.lineOfBusiness}
            hint="Determines which team receives the request."
            required
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="lineOfBusiness"
                value={values.lineOfBusiness}
                onChange={(e) => set('lineOfBusiness', e.target.value)}
                aria-describedby={describedBy}
                invalid={invalid}
              >
                <option value="">Select…</option>
                {LINES_OF_BUSINESS.map((lob) => (
                  <option key={lob} value={lob}>
                    {lob}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          id="field-description"
          label="Description"
          error={errors.description}
          hint="What are you requesting, and any detail the team should know. 20 characters minimum."
          required
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              name="description"
              rows={5}
              maxLength={2000}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="Adding six tractors and four trailers to the fleet ahead of the Q3 contract. Requesting a revised commercial auto quote."
            />
          )}
        </Field>
      </fieldset>

      {/* Document ------------------------------------------------------- */}
      <fieldset className="flex flex-col gap-5" disabled={submitting}>
        <legend className="mb-1 text-[13px] font-semibold tracking-widest text-[var(--subtle)] uppercase">
          Document
        </legend>

        <FileUpload
          file={file}
          onFileChange={setFile}
          error={fileError ?? errors.document}
          onValidationError={setFileError}
          maxBytes={config.maxUploadMb * 1024 * 1024}
          acceptedMimeTypes={defaultAcceptedMimeTypes}
          disabled={submitting}
        />
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-snug text-[var(--subtle)]">
          Synthetic demonstration data only. Do not enter real client
          information.
        </p>
        <Button type="submit" size="lg" disabled={submitting} className="sm:w-auto">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Processing…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              Submit request
            </>
          )}
        </Button>
      </div>

      <p aria-live="polite" className="sr-only">
        {submitting ? 'Submitting your request.' : ''}
      </p>
    </form>
  )
}
