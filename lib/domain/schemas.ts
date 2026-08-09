/**
 * Validation schemas (FR-013, FR-023).
 *
 * Two boundaries are validated:
 *
 *  1. The intake form. The *same* schema runs in the browser and again on the
 *     server, so client-side and server-side validation cannot drift.
 *  2. The extraction response. Output from Azure is untrusted input and is
 *     parsed, not assumed (IR-004).
 */

import { z } from 'zod'
import {
  ACCEPTED_MIME_TYPES,
  LINES_OF_BUSINESS,
  POLICY_TYPES,
  SUBMISSION_TYPES,
} from './enums'

// ---------------------------------------------------------------------------
// Field-level building blocks
// ---------------------------------------------------------------------------

const trimmed = (schema: z.ZodString) => z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : v),
  schema,
)

export const nameSchema = trimmed(
  z
    .string()
    .min(2, 'Enter your full name.')
    .max(120, 'Name must be 120 characters or fewer.'),
)

export const companySchema = trimmed(
  z
    .string()
    .min(2, 'Enter the company name.')
    .max(160, 'Company name must be 160 characters or fewer.'),
)

export const emailSchema = trimmed(
  z
    .string()
    .min(1, 'Enter an email address.')
    .max(254, 'Email must be 254 characters or fewer.')
    .regex(
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
      'Enter a valid email address, for example name@company.com.',
    ),
)

/**
 * Deliberately permissive: international formats vary, and rejecting a valid
 * number is worse for intake than accepting an oddly formatted one. Requires
 * at least 10 digits after stripping formatting characters.
 */
export const phoneSchema = trimmed(
  z
    .string()
    .min(1, 'Enter a phone number.')
    .max(32, 'Phone number must be 32 characters or fewer.')
    .refine(
      (v) => (v.match(/\d/g) ?? []).length >= 10,
      'Enter a phone number with at least 10 digits.',
    ),
)

export const descriptionSchema = trimmed(
  z
    .string()
    .min(20, 'Describe the request in at least 20 characters.')
    .max(2000, 'Description must be 2000 characters or fewer.'),
)

// ---------------------------------------------------------------------------
// Intake form (FR-001, FR-013)
// ---------------------------------------------------------------------------

export const intakeFormSchema = z.object({
  clientName: nameSchema,
  companyName: companySchema,
  email: emailSchema,
  phone: phoneSchema,
  submissionType: z.enum(SUBMISSION_TYPES, {
    message: 'Select whether this is a quote or a claim.',
  }),
  lineOfBusiness: z.enum(LINES_OF_BUSINESS, {
    message: 'Select a line of business.',
  }),
  description: descriptionSchema,
})

export type IntakeFormValues = z.infer<typeof intakeFormSchema>

/** Blank form state. Keeps the React form controlled from first render. */
export const emptyIntakeForm: Record<keyof IntakeFormValues, string> = {
  clientName: '',
  companyName: '',
  email: '',
  phone: '',
  submissionType: '',
  lineOfBusiness: '',
  description: '',
}

// ---------------------------------------------------------------------------
// Upload validation (FR-014, BR-012)
// ---------------------------------------------------------------------------

export interface UploadConstraints {
  maxBytes: number
  acceptedMimeTypes: readonly string[]
}

export interface UploadValidationResult {
  ok: boolean
  /** `type` or `size` — lets the UI mark the right control (AC-007). */
  reason?: 'type' | 'size'
  message?: string
}

/**
 * Shared by the client and the server. The client copy is a courtesy; the
 * server copy is the enforcement, since a browser check can be bypassed.
 */
export function validateUpload(
  file: { name: string; type: string; size: number },
  constraints: UploadConstraints,
): UploadValidationResult {
  if (!constraints.acceptedMimeTypes.includes(file.type)) {
    return {
      ok: false,
      reason: 'type',
      message: `Unsupported file type "${file.type || 'unknown'}". Accepted: PDF, PNG, JPEG, or TIFF.`,
    }
  }

  if (file.size > constraints.maxBytes) {
    const limitMb = Math.round(constraints.maxBytes / (1024 * 1024))
    const actualMb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      ok: false,
      reason: 'size',
      message: `File is ${actualMb} MB. The maximum is ${limitMb} MB.`,
    }
  }

  if (file.size === 0) {
    return { ok: false, reason: 'size', message: 'The file is empty.' }
  }

  return { ok: true }
}

export const defaultAcceptedMimeTypes = ACCEPTED_MIME_TYPES

// ---------------------------------------------------------------------------
// Extraction result (FR-022, FR-023, IR-004)
// ---------------------------------------------------------------------------

const confidence = z
  .number()
  .min(0, 'Confidence must be between 0 and 1.')
  .max(1, 'Confidence must be between 0 and 1.')

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD).')

/**
 * The shape every extraction adapter must return, whatever the upstream
 * service actually sent. An adapter normalizes into this before returning;
 * anything that fails to parse is an extraction failure, never partial data
 * (BR-009).
 */
export const normalizedExtractionSchema = z.object({
  carrier: z.string().min(1).nullable(),
  policyNumber: z.string().min(1).nullable(),
  effectiveDate: isoDate.nullable(),
  expirationDate: isoDate.nullable(),
  namedInsured: z.string().min(1).nullable(),
  policyType: z.enum(POLICY_TYPES),
  coverageAmount: z.number().nonnegative().nullable(),
  fieldConfidence: z.record(z.string(), confidence),
  extractionConfidence: confidence,
})

export type NormalizedExtraction = z.infer<typeof normalizedExtractionSchema>

/**
 * Fields that must be present for an extraction to be considered complete
 * (BR-010). Absence sends the submission to Intake Correction rather than
 * failing the run — the values that *were* extracted are still worth keeping.
 */
export const REQUIRED_EXTRACTION_FIELDS = [
  'namedInsured',
  'policyNumber',
  'carrier',
] as const satisfies readonly (keyof NormalizedExtraction)[]

export function findMissingRequiredFields(
  extraction: NormalizedExtraction,
): string[] {
  return REQUIRED_EXTRACTION_FIELDS.filter((field) => {
    const value = extraction[field]
    return value === null || value === undefined || value === ''
  })
}

// ---------------------------------------------------------------------------
// Azure raw response (IR-004)
// ---------------------------------------------------------------------------

/**
 * A permissive view of the Azure Document Intelligence `analyzeResult`. Only
 * the parts this system reads are described; unknown properties are ignored
 * rather than rejected, so an additive change upstream does not break intake.
 * Structural assumptions that *are* load-bearing — `documents[].fields` being
 * an object of `{ content, valueString?, confidence? }` — are enforced.
 */
export const azureFieldSchema = z.object({
  type: z.string().optional(),
  content: z.string().optional(),
  valueString: z.string().optional(),
  valueNumber: z.number().optional(),
  valueDate: z.string().optional(),
  valueCurrency: z
    .object({ amount: z.number().optional(), currencyCode: z.string().optional() })
    .optional(),
  confidence: z.number().optional(),
})

export const azureAnalyzeResultSchema = z.object({
  status: z.string().optional(),
  analyzeResult: z
    .object({
      apiVersion: z.string().optional(),
      modelId: z.string().optional(),
      content: z.string().optional(),
      documents: z
        .array(
          z.object({
            docType: z.string().optional(),
            confidence: z.number().optional(),
            fields: z.record(z.string(), azureFieldSchema).optional(),
          }),
        )
        .optional(),
      keyValuePairs: z
        .array(
          z.object({
            key: z.object({ content: z.string().optional() }).optional(),
            value: z.object({ content: z.string().optional() }).optional(),
            confidence: z.number().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
})

export type AzureAnalyzeResult = z.infer<typeof azureAnalyzeResultSchema>

// ---------------------------------------------------------------------------
// API request/response contracts
// ---------------------------------------------------------------------------

export const submissionResponseSchema = z.object({
  submissionId: z.string(),
  status: z.string(),
  assignedTeam: z.string(),
  needsHumanReview: z.boolean(),
  reviewReasons: z.array(z.string()),
  duplicateFlag: z.boolean(),
  confidenceScore: z.number().nullable(),
  extractionProvider: z.string().nullable(),
  message: z.string(),
})

export type SubmissionResponse = z.infer<typeof submissionResponseSchema>

/** Field-level errors keyed by form field name, as the intake UI renders them. */
export type FieldErrors = Partial<Record<string, string>>

/**
 * Flattens a Zod error into `{ fieldName: firstMessage }`. Only the first
 * message per field is surfaced — showing four errors on one input is noise.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    if (!(key in result)) result[key] = issue.message
  }
  return result
}
