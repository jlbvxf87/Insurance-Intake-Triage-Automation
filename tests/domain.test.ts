import { describe, it, expect, beforeEach } from 'vitest'
import {
  intakeFormSchema,
  validateUpload,
  normalizedExtractionSchema,
  findMissingRequiredFields,
  toFieldErrors,
  defaultAcceptedMimeTypes,
  type NormalizedExtraction,
} from '@/lib/domain/schemas'
import { normalizeEmail, normalizeCompanyName, normalizePhone } from '@/lib/utils/normalize'
import { isWithinDays, daysAgo, wholeDaysBetween } from '@/lib/utils/dates'
import { getConfig, toPublicConfig } from '@/lib/config'
import { InMemoryRepository } from '@/lib/data/memory-repository'
import { createSeedData } from '@/lib/data/seed'
import { resetIds } from '@/lib/utils/ids'

const validForm = {
  clientName: 'Dana Whitfield',
  companyName: 'ACME Trucking LLC',
  email: 'dispatch@acmetrucking.example',
  phone: '(816) 555-0142',
  submissionType: 'Quote',
  lineOfBusiness: 'Commercial Auto',
  description:
    'Adding six tractors and four trailers to the fleet ahead of the Q3 contract.',
}

describe('intake form validation (FR-013)', () => {
  it('accepts a complete valid submission', () => {
    expect(intakeFormSchema.safeParse(validForm).success).toBe(true)
  })

  it('trims surrounding whitespace before validating', () => {
    const parsed = intakeFormSchema.parse({
      ...validForm,
      clientName: '  Dana Whitfield  ',
      email: '  dispatch@acmetrucking.example ',
    })
    expect(parsed.clientName).toBe('Dana Whitfield')
    expect(parsed.email).toBe('dispatch@acmetrucking.example')
  })

  it('rejects a malformed email with a field-level message (TC-19)', () => {
    const result = intakeFormSchema.safeParse({ ...validForm, email: 'not-an-email' })
    expect(result.success).toBe(false)
    expect(toFieldErrors(result.error!).email).toMatch(/valid email/i)
  })

  it('rejects a missing required field (TC-18)', () => {
    const result = intakeFormSchema.safeParse({ ...validForm, companyName: '' })
    expect(result.success).toBe(false)
    expect(toFieldErrors(result.error!).companyName).toBeDefined()
  })

  it('rejects a description over the maximum length (TC-20)', () => {
    const result = intakeFormSchema.safeParse({
      ...validForm,
      description: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
    expect(toFieldErrors(result.error!).description).toMatch(/2000/)
  })

  it('rejects a phone number with fewer than 10 digits', () => {
    const result = intakeFormSchema.safeParse({ ...validForm, phone: '555-0142' })
    expect(result.success).toBe(false)
  })

  it('accepts international phone formatting', () => {
    expect(
      intakeFormSchema.safeParse({ ...validForm, phone: '+44 20 7946 0958' }).success,
    ).toBe(true)
  })

  it('rejects a line of business outside the option set', () => {
    const result = intakeFormSchema.safeParse({ ...validForm, lineOfBusiness: 'Marine' })
    expect(result.success).toBe(false)
  })

  it('surfaces only the first message per field', () => {
    const result = intakeFormSchema.safeParse({ ...validForm, clientName: '' })
    const errors = toFieldErrors(result.error!)
    expect(Object.keys(errors)).toContain('clientName')
    expect(typeof errors.clientName).toBe('string')
  })
})

describe('upload validation (FR-014, BR-012)', () => {
  const constraints = {
    maxBytes: 10 * 1024 * 1024,
    acceptedMimeTypes: defaultAcceptedMimeTypes,
  }

  it('accepts a PDF within the size limit', () => {
    expect(
      validateUpload({ name: 'dec.pdf', type: 'application/pdf', size: 250_000 }, constraints)
        .ok,
    ).toBe(true)
  })

  it('accepts scanned image formats', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/tiff']) {
      expect(validateUpload({ name: 'scan', type, size: 100_000 }, constraints).ok).toBe(true)
    }
  })

  it('rejects an unsupported type with reason "type" (TC-07)', () => {
    const result = validateUpload(
      { name: 'payload.exe', type: 'application/x-msdownload', size: 1_000 },
      constraints,
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('type')
    expect(result.message).toMatch(/Unsupported file type/)
  })

  it('rejects an oversize file with reason "size" (TC-07)', () => {
    const result = validateUpload(
      { name: 'huge.pdf', type: 'application/pdf', size: 12 * 1024 * 1024 },
      constraints,
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('size')
    expect(result.message).toMatch(/12\.0 MB/)
  })

  it('rejects an empty file', () => {
    expect(
      validateUpload({ name: 'empty.pdf', type: 'application/pdf', size: 0 }, constraints).ok,
    ).toBe(false)
  })
})

describe('normalization (FR-017, TC-21)', () => {
  it('normalizes email casing and surrounding whitespace to one key', () => {
    const variants = [
      'dispatch@acmetrucking.example',
      'Dispatch@ACMETrucking.Example',
      '  DISPATCH@ACMETRUCKING.EXAMPLE  ',
    ]
    const keys = new Set(variants.map(normalizeEmail))
    expect(keys.size).toBe(1)
    expect([...keys][0]).toBe('dispatch@acmetrucking.example')
  })

  it('does not strip plus-addressing', () => {
    // Deliberate: over-matching would attach a submission to the wrong client.
    expect(normalizeEmail('ops+claims@acme.example')).not.toBe(
      normalizeEmail('ops@acme.example'),
    )
  })

  it('normalizes company suffixes for comparison only', () => {
    expect(normalizeCompanyName('ACME Trucking LLC')).toBe(
      normalizeCompanyName('Acme Trucking, L.L.C.'.replace(/\./g, '')),
    )
  })

  it('reduces a phone number to digits', () => {
    expect(normalizePhone('(816) 555-0142')).toBe('8165550142')
  })
})

describe('duplicate window arithmetic (BR-013, BR-014)', () => {
  const now = '2026-08-09T15:00:00.000Z'

  it('treats a submission inside the window as in range', () => {
    expect(isWithinDays(daysAgo(5, now), now, 30)).toBe(true)
  })

  it('treats a submission outside the window as out of range (TC-04b)', () => {
    expect(isWithinDays(daysAgo(45, now), now, 30)).toBe(false)
  })

  it('treats the window boundary as inclusive', () => {
    expect(isWithinDays(daysAgo(30, now), now, 30)).toBe(true)
  })

  it('reports whole days elapsed for the duplicate reason text', () => {
    expect(wholeDaysBetween(daysAgo(5, now), now)).toBe(5)
  })
})

describe('configuration (IR-002, NFR-001)', () => {
  it('resolves to fixture mode when no Azure credentials are present', () => {
    const config = getConfig({ EXTRACTION_PROVIDER: 'auto' })
    expect(config.extractionProvider).toBe('fixture')
    expect(toPublicConfig(config).isDemoMode).toBe(true)
  })

  it('resolves to azure when both endpoint and key are present', () => {
    const config = getConfig({
      EXTRACTION_PROVIDER: 'auto',
      AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: 'https://example.cognitiveservices.azure.com',
      AZURE_DOCUMENT_INTELLIGENCE_KEY: 'test-key',
    })
    expect(config.extractionProvider).toBe('azure')
    expect(toPublicConfig(config).isDemoMode).toBe(false)
  })

  it('honours an explicit fixture override even when Azure is configured', () => {
    const config = getConfig({
      EXTRACTION_PROVIDER: 'fixture',
      AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: 'https://example.cognitiveservices.azure.com',
      AZURE_DOCUMENT_INTELLIGENCE_KEY: 'test-key',
    })
    expect(config.extractionProvider).toBe('fixture')
  })

  it('applies documented defaults for the tunable thresholds', () => {
    const config = getConfig({})
    expect(config.confidenceThreshold).toBe(0.8)
    expect(config.duplicateWindowDays).toBe(30)
    expect(config.maxUploadBytes).toBe(10 * 1024 * 1024)
  })

  it('clamps an out-of-range confidence threshold into 0..1', () => {
    expect(getConfig({ EXTRACTION_CONFIDENCE_THRESHOLD: '5' }).confidenceThreshold).toBe(1)
    expect(getConfig({ EXTRACTION_CONFIDENCE_THRESHOLD: '-2' }).confidenceThreshold).toBe(0)
  })

  it('falls back to defaults for unparseable values', () => {
    expect(getConfig({ DUPLICATE_WINDOW_DAYS: 'thirty' }).duplicateWindowDays).toBe(30)
  })

  it('exposes no secret through the public projection (NFR-001)', () => {
    const publicConfig = toPublicConfig(
      getConfig({
        AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: 'https://example.cognitiveservices.azure.com',
        AZURE_DOCUMENT_INTELLIGENCE_KEY: 'super-secret-key',
      }),
    )
    expect(JSON.stringify(publicConfig)).not.toContain('super-secret-key')
    expect(JSON.stringify(publicConfig)).not.toContain('cognitiveservices')
  })
})

describe('extraction schema (FR-022, FR-023)', () => {
  const valid: NormalizedExtraction = {
    carrier: 'Example Insurance',
    policyNumber: 'CA-829103',
    effectiveDate: '2026-01-01',
    expirationDate: '2027-01-01',
    namedInsured: 'ACME Trucking LLC',
    policyType: 'Commercial Auto',
    coverageAmount: 1_000_000,
    fieldConfidence: { namedInsured: 0.98, policyNumber: 0.96, carrier: 0.93 },
    extractionConfidence: 0.94,
  }

  it('accepts a well-formed normalized extraction', () => {
    expect(normalizedExtractionSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a confidence outside 0..1', () => {
    expect(
      normalizedExtractionSchema.safeParse({ ...valid, extractionConfidence: 1.4 }).success,
    ).toBe(false)
  })

  it('rejects a non-ISO date', () => {
    expect(
      normalizedExtractionSchema.safeParse({ ...valid, effectiveDate: '01/01/2026' }).success,
    ).toBe(false)
  })

  it('rejects an unknown policy type', () => {
    expect(
      normalizedExtractionSchema.safeParse({ ...valid, policyType: 'Marine' }).success,
    ).toBe(false)
  })

  it('accepts null for optional fields', () => {
    expect(
      normalizedExtractionSchema.safeParse({
        ...valid,
        coverageAmount: null,
        effectiveDate: null,
      }).success,
    ).toBe(true)
  })

  it('reports missing required fields by name (BR-010)', () => {
    expect(findMissingRequiredFields(valid)).toEqual([])
    expect(findMissingRequiredFields({ ...valid, policyNumber: null })).toEqual([
      'policyNumber',
    ])
    expect(
      findMissingRequiredFields({ ...valid, policyNumber: null, carrier: null }).sort(),
    ).toEqual(['carrier', 'policyNumber'])
  })
})

describe('seed data and repository (DR-001 – DR-004, DR-007)', () => {
  const reference = new Date('2026-08-09T15:00:00.000Z')
  let repo: InMemoryRepository

  beforeEach(() => {
    resetIds()
    const seed = createSeedData(reference)
    repo = new InMemoryRepository(seed)
  })

  it('seeds every entity type', async () => {
    expect((await repo.listClients()).length).toBe(8)
    expect((await repo.listSubmissions()).length).toBe(24)
    expect((await repo.listLogs()).length).toBe(24)
  })

  it('uses only synthetic .example addresses (DR-007)', async () => {
    for (const client of await repo.listClients()) {
      expect(client.email).toMatch(/\.example$/)
    }
  })

  it('stores a normalized email for every client', async () => {
    for (const client of await repo.listClients()) {
      expect(client.normalizedEmail).toBe(normalizeEmail(client.email))
    }
  })

  it('finds a client by normalized email regardless of input casing', async () => {
    const found = await repo.findClientByNormalizedEmail(
      normalizeEmail('  Dispatch@ACMETrucking.Example '),
    )
    expect(found?.clientId).toBe('CLI-1001')
  })

  it('returns null for an unknown email', async () => {
    expect(await repo.findClientByNormalizedEmail('nobody@nowhere.example')).toBeNull()
  })

  it('links every submission to an existing client (DR-002)', async () => {
    const clientIds = new Set((await repo.listClients()).map((c) => c.clientId))
    for (const submission of await repo.listSubmissions()) {
      expect(clientIds.has(submission.clientId)).toBe(true)
    }
  })

  it('holds at most one extraction per submission (DR-003)', async () => {
    const details = await repo.listSubmissionDetails()
    const withExtraction = details.filter((d) => d.extraction !== null)
    expect(withExtraction.length).toBe(8)
    const submissionIds = withExtraction.map((d) => d.extraction!.submissionId)
    expect(new Set(submissionIds).size).toBe(submissionIds.length)
  })

  it('writes an automation log for every submission (DR-004)', async () => {
    for (const submission of await repo.listSubmissions()) {
      expect((await repo.listLogsBySubmission(submission.submissionId)).length).toBeGreaterThan(0)
    }
  })

  it('returns duplicate candidates matching client, type, and line of business', async () => {
    const candidates = await repo.findDuplicateCandidates({
      clientId: 'CLI-1001',
      submissionType: 'Quote',
      lineOfBusiness: 'Commercial Auto',
    })
    expect(candidates.length).toBeGreaterThanOrEqual(2)
    for (const candidate of candidates) {
      expect(candidate.clientId).toBe('CLI-1001')
      expect(candidate.submissionType).toBe('Quote')
      expect(candidate.lineOfBusiness).toBe('Commercial Auto')
    }
  })

  it('does not leak internal state through returned objects', async () => {
    const first = await repo.getClient('CLI-1001')
    first!.companyName = 'MUTATED'
    const second = await repo.getClient('CLI-1001')
    expect(second!.companyName).toBe('ACME Trucking LLC')
  })

  it('records a review reason for every submission needing review', async () => {
    for (const submission of await repo.listSubmissions()) {
      if (submission.needsHumanReview) {
        expect(submission.reviewReasons.length).toBeGreaterThan(0)
      }
    }
  })

  it('records a failing step and message for every Exception submission (FR-033)', async () => {
    const details = await repo.listSubmissionDetails()
    const exceptions = details.filter((d) => d.submission.status === 'Exception')
    expect(exceptions.length).toBeGreaterThan(0)
    for (const detail of exceptions) {
      const failed = detail.logs.find((l) => l.status === 'Failed')
      expect(failed?.stepFailed).toBeTruthy()
      expect(failed?.errorMessage).toBeTruthy()
    }
  })

  it('never leaves a seeded submission in Processing (NFR-005)', async () => {
    for (const submission of await repo.listSubmissions()) {
      expect(submission.status).not.toBe('Processing')
    }
  })
})
