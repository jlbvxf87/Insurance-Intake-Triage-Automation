/**
 * Deterministic extraction fixtures (FR-026, NFR-017).
 *
 * Purpose: the project must run end to end from a clean clone with no Azure
 * subscription, and the exception paths must be reachable in a live demo
 * without breaking a real service.
 *
 * Selection is by *file name*, so a reviewer can steer the demo deliberately —
 * upload something named `low-confidence.pdf` and the review path runs.
 * Anything else gets the high-confidence fixture. This is stated in the UI, so
 * fixture output is never mistaken for a live Azure result.
 */

import type { NormalizedExtraction } from '../domain/schemas'

export interface Fixture {
  id: string
  /** Substring matched against the lower-cased uploaded file name. */
  match: string[]
  description: string
  data: NormalizedExtraction
}

export const HIGH_CONFIDENCE: NormalizedExtraction = {
  carrier: 'Example Insurance',
  policyNumber: 'CA-829103',
  namedInsured: 'ACME Trucking LLC',
  effectiveDate: '2026-01-01',
  expirationDate: '2027-01-01',
  policyType: 'Commercial Auto',
  coverageAmount: 1_000_000,
  fieldConfidence: {
    namedInsured: 0.98,
    policyNumber: 0.96,
    carrier: 0.93,
    effectiveDate: 0.92,
    expirationDate: 0.91,
    coverageAmount: 0.94,
  },
  extractionConfidence: 0.94,
}

export const FIXTURES: Fixture[] = [
  {
    id: 'high-confidence',
    match: ['dec-page', 'declarations', 'acme', 'high-confidence'],
    description: 'Clean native PDF declarations page. All required fields present.',
    data: HIGH_CONFIDENCE,
  },
  {
    id: 'low-confidence',
    match: ['low-confidence', 'scan', 'photo', 'faxed'],
    description:
      'Poor-quality scan. All fields present but below the confidence threshold — routes to review.',
    data: {
      carrier: 'Granite State Casualty',
      policyNumber: 'WC-55120-B',
      namedInsured: 'Belmont Fabrication Co',
      effectiveDate: '2026-02-15',
      expirationDate: '2027-02-15',
      policyType: 'Workers Compensation',
      coverageAmount: 1_000_000,
      fieldConfidence: {
        namedInsured: 0.71,
        policyNumber: 0.48,
        carrier: 0.66,
        effectiveDate: 0.59,
        expirationDate: 0.55,
        coverageAmount: 0.73,
      },
      extractionConfidence: 0.62,
    },
  },
  {
    id: 'missing-field',
    match: ['missing', 'partial', 'incomplete'],
    description:
      'Acceptable confidence but no policy number — routes to Intake Correction.',
    data: {
      carrier: 'Ridgeline Indemnity',
      policyNumber: null,
      namedInsured: 'Riverbend Logistics',
      effectiveDate: '2026-05-01',
      expirationDate: '2027-05-01',
      policyType: 'Commercial Auto',
      coverageAmount: 750_000,
      fieldConfidence: {
        namedInsured: 0.91,
        carrier: 0.85,
        effectiveDate: 0.82,
        expirationDate: 0.8,
        coverageAmount: 0.83,
      },
      extractionConfidence: 0.84,
    },
  },
  {
    id: 'boundary',
    match: ['boundary', 'threshold'],
    description:
      'Aggregate confidence exactly at the default threshold — exercises the inclusive boundary.',
    data: {
      carrier: 'Meridian Mutual',
      policyNumber: 'PR-4471902',
      namedInsured: 'Lakeline Storage Partners',
      effectiveDate: '2026-03-01',
      expirationDate: '2027-03-01',
      policyType: 'Commercial Property',
      coverageAmount: 2_500_000,
      fieldConfidence: {
        namedInsured: 0.8,
        policyNumber: 0.8,
        carrier: 0.8,
        effectiveDate: 0.8,
      },
      extractionConfidence: 0.8,
    },
  },
  {
    id: 'property',
    match: ['property', 'building', 'lakeline'],
    description: 'Commercial property declarations page.',
    data: {
      carrier: 'Meridian Mutual',
      policyNumber: 'PR-3390188',
      namedInsured: 'Northside Property Group',
      effectiveDate: '2025-11-01',
      expirationDate: '2026-11-01',
      policyType: 'Commercial Property',
      coverageAmount: 4_000_000,
      fieldConfidence: {
        namedInsured: 0.93,
        policyNumber: 0.88,
        carrier: 0.86,
        effectiveDate: 0.87,
        expirationDate: 0.85,
        coverageAmount: 0.89,
      },
      extractionConfidence: 0.88,
    },
  },
]

/** File names that deliberately trigger a failure path, for demonstration. */
export const FAILURE_TRIGGERS: Record<string, { kind: 'timeout' | 'service_error' | 'malformed_response'; message: string }> = {
  'trigger-timeout': {
    kind: 'timeout',
    message: 'Document Intelligence request timed out after 30000 ms.',
  },
  'trigger-error': {
    kind: 'service_error',
    message: 'Document Intelligence returned 503 Service Unavailable after 3 attempt(s).',
  },
  'trigger-malformed': {
    kind: 'malformed_response',
    message:
      'Document Intelligence response did not match the expected shape: analyzeResult.documents expected array.',
  },
}

export function selectFixture(fileName: string): Fixture {
  const name = fileName.toLowerCase()
  return (
    FIXTURES.find((fixture) => fixture.match.some((token) => name.includes(token))) ??
    FIXTURES[0]
  )
}

export function selectFailureTrigger(fileName: string) {
  const name = fileName.toLowerCase()
  const key = Object.keys(FAILURE_TRIGGERS).find((token) => name.includes(token))
  return key ? FAILURE_TRIGGERS[key] : null
}
