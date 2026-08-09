/**
 * Azure response normalization (FR-022, IR-004).
 *
 * Document Intelligence returns loosely-shaped, model-dependent output:
 * `prebuilt-document` gives generic key/value pairs, a custom-trained model
 * gives named fields. This module reduces both to the one normalized shape the
 * rest of the system understands.
 *
 * The response is treated as untrusted input throughout. A field that is
 * missing, an unexpected type, or a confidence outside 0–1 yields `null` for
 * that field rather than a thrown error — the aggregate confidence and the
 * required-field check then decide whether the result is usable.
 */

import type { AzureAnalyzeResult } from '../domain/schemas'
import { normalizedExtractionSchema, type NormalizedExtraction } from '../domain/schemas'
import { POLICY_TYPES, type PolicyType } from '../domain/enums'

/**
 * Label variants seen on declarations pages and ACORD forms, mapped to our
 * field names. Matching is done on a normalized label so "Policy Number",
 * "policy no.", and "POLICY #" all resolve to the same target.
 */
const FIELD_ALIASES: Record<string, keyof NormalizedExtraction> = {
  namedinsured: 'namedInsured',
  insured: 'namedInsured',
  insuredname: 'namedInsured',
  nameandaddressofinsured: 'namedInsured',
  policynumber: 'policyNumber',
  policyno: 'policyNumber',
  policy: 'policyNumber',
  policynum: 'policyNumber',
  carrier: 'carrier',
  insurer: 'carrier',
  insurancecompany: 'carrier',
  company: 'carrier',
  underwriter: 'carrier',
  effectivedate: 'effectiveDate',
  policyeffectivedate: 'effectiveDate',
  inceptiondate: 'effectiveDate',
  expirationdate: 'expirationDate',
  policyexpirationdate: 'expirationDate',
  expirydate: 'expirationDate',
  coverageamount: 'coverageAmount',
  limitofliability: 'coverageAmount',
  eachoccurrence: 'coverageAmount',
  limit: 'coverageAmount',
  policytype: 'policyType',
  typeofpolicy: 'policyType',
  coveragetype: 'policyType',
}

const normalizeLabel = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]/g, '')

/** `$1,000,000` / `1.000.000,00` / `USD 1000000` → `1000000`. */
export function parseCurrency(raw: string | number | undefined | null): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (!raw) return null

  const cleaned = raw.replace(/[^\d.,-]/g, '')
  if (cleaned === '') return null

  // Decide which separator is the decimal point by taking the last one seen.
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let candidate = cleaned

  if (lastComma > lastDot) {
    candidate = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    candidate = cleaned.replace(/,/g, '')
  }

  const value = Number(candidate)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** Accepts ISO, US, and long-form dates. Returns `YYYY-MM-DD` or null. */
export function parseDate(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const us = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (us) {
    const [, m, d, y] = us
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

/** Maps free-text policy descriptions onto the constrained option set. */
export function parsePolicyType(raw: string | undefined | null): PolicyType {
  if (!raw) return 'Unknown'
  const normalized = normalizeLabel(raw)

  const exact = POLICY_TYPES.find((t) => normalizeLabel(t) === normalized)
  if (exact) return exact

  if (/commercialauto|businessauto|fleet|trucking/.test(normalized)) return 'Commercial Auto'
  if (/property|building|contents/.test(normalized)) return 'Commercial Property'
  if (/generalliability|cgl|liability/.test(normalized)) return 'General Liability'
  if (/workerscomp|workmanscomp|wc/.test(normalized)) return 'Workers Compensation'
  if (/umbrella|excess/.test(normalized)) return 'Umbrella'

  return 'Unknown'
}

const clampConfidence = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null

interface RawField {
  value: string | number | null
  confidence: number | null
}

/**
 * Collects candidate values from both shapes Document Intelligence can return:
 * `documents[].fields` (custom or prebuilt models with a document type) and
 * `keyValuePairs` (the generic `prebuilt-document` output).
 *
 * Named fields win over key/value pairs when both are present — a trained
 * model's labelled field is more reliable than a heuristic label match.
 */
function collectFields(result: AzureAnalyzeResult): Map<keyof NormalizedExtraction, RawField> {
  const collected = new Map<keyof NormalizedExtraction, RawField>()
  const analyze = result.analyzeResult

  for (const pair of analyze?.keyValuePairs ?? []) {
    const label = pair.key?.content
    const value = pair.value?.content
    if (!label || value === undefined) continue

    const target = FIELD_ALIASES[normalizeLabel(label)]
    if (!target || collected.has(target)) continue

    collected.set(target, { value, confidence: clampConfidence(pair.confidence) })
  }

  for (const document of analyze?.documents ?? []) {
    for (const [label, field] of Object.entries(document.fields ?? {})) {
      const target = FIELD_ALIASES[normalizeLabel(label)]
      if (!target) continue

      const value =
        field.valueString ??
        field.valueDate ??
        field.valueCurrency?.amount ??
        field.valueNumber ??
        field.content ??
        null

      if (value === null || value === '') continue

      // Named fields overwrite key/value pairs.
      collected.set(target, { value, confidence: clampConfidence(field.confidence) })
    }
  }

  return collected
}

export interface NormalizationOutcome {
  ok: boolean
  data?: NormalizedExtraction
  error?: string
}

/**
 * Normalize a raw Azure response into the shared shape.
 *
 * Returns `{ ok: false }` when the payload cannot produce a schema-valid
 * result — that is an extraction failure (BR-009), never partial data passed
 * downstream as if it were trustworthy.
 */
export function normalizeAzureResult(result: AzureAnalyzeResult): NormalizationOutcome {
  const collected = collectFields(result)

  if (collected.size === 0) {
    return {
      ok: false,
      error:
        'No recognizable policy fields were found in the document. The response contained no matching fields or key/value pairs.',
    }
  }

  const fieldConfidence: Record<string, number> = {}
  for (const [field, raw] of collected) {
    if (raw.confidence !== null) fieldConfidence[field] = raw.confidence
  }

  const text = (field: keyof NormalizedExtraction): string | null => {
    const raw = collected.get(field)?.value
    if (raw === null || raw === undefined) return null
    const value = String(raw).trim()
    return value === '' ? null : value
  }

  // Aggregate = mean of per-field confidences (see Q-2 in the architecture
  // note). Mean rather than minimum: a single weak ancillary field should not
  // send an otherwise clean extraction to review, and per-field confidences are
  // retained so a reviewer can still see the weak one (BR-018).
  const confidences = Object.values(fieldConfidence)
  const aggregate =
    confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0

  const candidate: NormalizedExtraction = {
    carrier: text('carrier'),
    policyNumber: text('policyNumber'),
    namedInsured: text('namedInsured'),
    effectiveDate: parseDate(text('effectiveDate')),
    expirationDate: parseDate(text('expirationDate')),
    policyType: parsePolicyType(text('policyType')),
    coverageAmount: parseCurrency(collected.get('coverageAmount')?.value ?? null),
    fieldConfidence,
    extractionConfidence: Math.min(1, Math.max(0, aggregate)),
  }

  const parsed = normalizedExtractionSchema.safeParse(candidate)
  if (!parsed.success) {
    return {
      ok: false,
      error: `Extraction result failed schema validation: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    }
  }

  return { ok: true, data: parsed.data }
}
