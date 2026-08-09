import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryRepository } from '@/lib/data/memory-repository'
import type { Repository } from '@/lib/data/repository'
import { seedRepository, syncIdCountersFromStore } from '@/lib/data/seed-repository'
import { runIntakeWorkflow } from '@/lib/workflow/orchestrator'
import { nextId, resetIds } from '@/lib/utils/ids'
import { NOW, documentNamed, instantExtractor, testConfig, validInput } from './helpers'

/**
 * Repository contract.
 *
 * The `Repository` interface makes a claim: swap the implementation and
 * nothing above it changes. That claim is only worth anything if it is
 * checked, so this suite is written against the *interface* and run against
 * every implementation.
 *
 * `InMemoryRepository` always runs. `PostgresRepository` runs when
 * `TEST_DATABASE_URL` is set, and is reported as skipped otherwise rather than
 * quietly passing — a contract test that silently tests one implementation is
 * worse than none, because it reads like coverage.
 */

const POSTGRES_URL = process.env.TEST_DATABASE_URL

interface Implementation {
  name: string
  create: () => Promise<Repository>
}

const implementations: Implementation[] = [
  {
    name: 'InMemoryRepository',
    create: async () => {
      resetIds()
      const repository = new InMemoryRepository()
      await seedRepository(repository, new Date(NOW))
      return repository
    },
  },
]

if (POSTGRES_URL) {
  implementations.push({
    name: 'PostgresRepository',
    create: async () => {
      resetIds()
      const { PostgresRepository } = await import('@/lib/data/postgres-repository')
      const repository = new PostgresRepository(POSTGRES_URL)
      await repository.truncateAll()
      await seedRepository(repository, new Date(NOW))
      return repository
    },
  })
}

describe.each(implementations)('$name satisfies the Repository contract', ({ create }) => {
  let repository: Repository

  beforeEach(async () => {
    repository = await create()
  })

  // -- Seeding -------------------------------------------------------------

  it('holds the full seeded dataset', async () => {
    expect((await repository.listClients()).length).toBe(8)
    expect((await repository.listSubmissions()).length).toBe(24)
    expect((await repository.listLogs()).length).toBe(24)
  })

  it('round-trips a client without altering any field', async () => {
    const stored = await repository.getClient('CLI-1001')
    expect(stored).toMatchObject({
      clientId: 'CLI-1001',
      clientName: 'Dana Whitfield',
      companyName: 'ACME Trucking LLC',
      email: 'dispatch@acmetrucking.example',
      normalizedEmail: 'dispatch@acmetrucking.example',
      clientType: 'Commercial',
      active: true,
    })
  })

  // -- Client matching (FR-017) --------------------------------------------

  it('finds a client by normalized email', async () => {
    const found = await repository.findClientByNormalizedEmail('dispatch@acmetrucking.example')
    expect(found?.clientId).toBe('CLI-1001')
  })

  it('returns null for an unknown email rather than throwing', async () => {
    expect(await repository.findClientByNormalizedEmail('nobody@nowhere.example')).toBeNull()
  })

  it('rejects a duplicate normalized email', async () => {
    // In memory this is an explicit check; in Postgres it is the alternate key
    // constraint. Both must refuse.
    await expect(
      repository.createClient({
        clientId: nextId('CLI', 90_001),
        clientName: 'Impostor',
        companyName: 'Impostor Co',
        email: 'Dispatch@ACMETrucking.Example',
        normalizedEmail: 'dispatch@acmetrucking.example',
        phone: '816-555-0000',
        clientType: 'Commercial',
        createdDate: NOW,
        active: true,
      }),
    ).rejects.toThrow()
  })

  // -- Nullable semantics --------------------------------------------------

  it('preserves the difference between a null and a zero confidence score', async () => {
    // SUB-10021 was submitted without a document; SUB-10022 extracted at 0.62.
    const noDocument = await repository.getSubmission('SUB-10021')
    const extracted = await repository.getSubmission('SUB-10022')

    expect(noDocument?.confidenceScore).toBeNull()
    expect(extracted?.confidenceScore).toBeCloseTo(0.62, 3)
  })

  it('round-trips the review reasons array', async () => {
    const submission = await repository.getSubmission('SUB-10023')
    expect(submission?.reviewReasons).toEqual(['Possible Duplicate'])
  })

  it('round-trips the document metadata object', async () => {
    const submission = await repository.getSubmission('SUB-10024')
    expect(submission?.originalDocument).toMatchObject({
      fileName: 'lakeline-dec-page.pdf',
      mimeType: 'application/pdf',
    })
  })

  it('stores null for a submission with no document', async () => {
    const submission = await repository.getSubmission('SUB-10021')
    expect(submission?.originalDocument).toBeNull()
  })

  // -- Duplicate candidates (BR-013) ---------------------------------------

  it('returns duplicate candidates matching client, type, and line of business', async () => {
    const candidates = await repository.findDuplicateCandidates({
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

  it('orders candidates most recent first', async () => {
    const candidates = await repository.findDuplicateCandidates({
      clientId: 'CLI-1001',
      submissionType: 'Quote',
      lineOfBusiness: 'Commercial Auto',
    })

    for (let i = 1; i < candidates.length; i += 1) {
      expect(candidates[i - 1].dateReceived >= candidates[i].dateReceived).toBe(true)
    }
  })

  // -- Extraction (DR-003) -------------------------------------------------

  it('round-trips per-field confidence and missing fields', async () => {
    const extraction = await repository.getExtractionBySubmission('SUB-10016')
    expect(extraction?.validationStatus).toBe('Failed')
    expect(extraction?.missingFields).toEqual(['policyNumber'])
    expect(extraction?.fieldConfidence.namedInsured).toBeCloseTo(0.91, 2)
  })

  it('holds at most one extraction per submission', async () => {
    const extraction = await repository.getExtractionBySubmission('SUB-10024')
    expect(extraction).not.toBeNull()

    await expect(
      repository.createExtraction({ ...extraction!, extractionId: 'EXT-99999' }),
    ).rejects.toThrow()
  })

  it('applies a partial extraction update without clearing other fields', async () => {
    const before = await repository.getExtractionBySubmission('SUB-10022')
    await repository.updateExtraction(before!.extractionId, {
      policyNumber: 'WC-CORRECTED',
      validationStatus: 'Validated',
    })

    const after = await repository.getExtractionBySubmission('SUB-10022')
    expect(after?.policyNumber).toBe('WC-CORRECTED')
    expect(after?.validationStatus).toBe('Validated')
    expect(after?.carrier).toBe(before?.carrier)
    expect(after?.extractionConfidence).toBeCloseTo(before!.extractionConfidence, 3)
  })

  // -- Logs (DR-004, NFR-007) ----------------------------------------------

  it('round-trips the step trace as structured data', async () => {
    const logs = await repository.listLogsBySubmission('SUB-10020')
    const failed = logs.find((log) => log.status === 'Failed')

    expect(failed?.stepFailed).toBe('Extract Document')
    expect(failed?.steps.length).toBeGreaterThan(0)
    expect(failed?.steps.some((step) => step.outcome === 'failed')).toBe(true)
  })

  it('writes an automation log for every submission', async () => {
    for (const submission of await repository.listSubmissions()) {
      const logs = await repository.listLogsBySubmission(submission.submissionId)
      expect(logs.length).toBeGreaterThan(0)
    }
  })

  // -- Updates -------------------------------------------------------------

  it('applies a partial submission update without clearing untouched fields', async () => {
    const before = await repository.getSubmission('SUB-10022')
    await repository.updateSubmission('SUB-10022', { status: 'Routed' })

    const after = await repository.getSubmission('SUB-10022')
    expect(after?.status).toBe('Routed')
    expect(after?.description).toBe(before?.description)
    expect(after?.assignedTeam).toBe(before?.assignedTeam)
    expect(after?.confidenceScore).toBeCloseTo(before!.confidenceScore!, 3)
  })

  it('can clear a nullable field explicitly', async () => {
    await repository.updateSubmission('SUB-10023', {
      duplicateFlag: false,
      duplicateReason: null,
      duplicateOfSubmissionId: null,
    })

    const after = await repository.getSubmission('SUB-10023')
    expect(after?.duplicateFlag).toBe(false)
    expect(after?.duplicateReason).toBeNull()
    expect(after?.duplicateOfSubmissionId).toBeNull()
  })

  it('rejects an update to a submission that does not exist', async () => {
    await expect(
      repository.updateSubmission('SUB-00000', { status: 'Closed' }),
    ).rejects.toThrow()
  })

  // -- Aggregate view ------------------------------------------------------

  it('assembles submission details with client, extraction, and logs', async () => {
    const detail = await repository.getSubmissionDetail('SUB-10024')
    expect(detail?.client.clientId).toBe('CLI-1008')
    expect(detail?.extraction?.policyNumber).toBe('PR-4471902')
    expect(detail?.logs.length).toBeGreaterThan(0)
  })

  it('lists every submission detail, most recent first', async () => {
    const details = await repository.listSubmissionDetails()
    expect(details.length).toBe(24)
    for (let i = 1; i < details.length; i += 1) {
      expect(
        details[i - 1].submission.dateReceived >= details[i].submission.dateReceived,
      ).toBe(true)
    }
  })

  it('returns null for an unknown submission detail', async () => {
    expect(await repository.getSubmissionDetail('SUB-00000')).toBeNull()
  })

  // -- Id allocation against a populated store -----------------------------

  it('advances id counters past whatever is already stored', async () => {
    await syncIdCountersFromStore(repository)

    const existing = new Set([
      ...(await repository.listSubmissions()).map((s) => s.submissionId),
      ...(await repository.listLogs()).map((l) => l.logId),
      ...(await repository.listClients()).map((c) => c.clientId),
    ])

    expect(existing.has(nextId('SUB'))).toBe(false)
    expect(existing.has(nextId('LOG'))).toBe(false)
    expect(existing.has(nextId('CLI', 1001))).toBe(false)
  })

  // -- The whole workflow, against this implementation ---------------------

  it('runs the full workflow end to end', async () => {
    await syncIdCountersFromStore(repository)

    const result = await runIntakeWorkflow({
      input: validInput({
        email: 'contract@harborworks.example',
        lineOfBusiness: 'Property',
      }),
      document: documentNamed('northside-property.pdf'),
      repository,
      config: testConfig(),
      extractor: instantExtractor(),
      now: NOW,
    })

    expect(result.status).toBe('Routed')
    expect(result.response.assignedTeam).toBe('Property Team')

    const stored = await repository.getSubmissionDetail(result.submissionId)
    expect(stored?.submission.status).toBe('Routed')
    expect(stored?.extraction?.namedInsured).toBe('Northside Property Group')
    expect(stored?.logs.length).toBe(1)
  })

  it('escalates a low-confidence submission end to end', async () => {
    await syncIdCountersFromStore(repository)

    const result = await runIntakeWorkflow({
      input: validInput({
        email: 'contract-low@harborworks.example',
        lineOfBusiness: 'Workers Compensation',
      }),
      document: documentNamed('low-confidence-scan.pdf'),
      repository,
      config: testConfig(),
      extractor: instantExtractor(),
      now: NOW,
    })

    expect(result.status).toBe('In Review')
    expect(result.response.reviewReasons).toContain('Low Confidence')

    const stored = await repository.getSubmissionDetail(result.submissionId)
    expect(stored?.extraction?.validationStatus).toBe('Unverified')
    expect(stored?.submission.needsHumanReview).toBe(true)
  })
})

describe('Postgres contract coverage', () => {
  it('reports whether the Postgres implementation was exercised', () => {
    if (!POSTGRES_URL) {
      // Deliberately visible. Set TEST_DATABASE_URL to run the same contract
      // against Postgres:
      //   TEST_DATABASE_URL='postgresql://...' npm test
      console.warn(
        '\n  ⚠ PostgresRepository contract SKIPPED — TEST_DATABASE_URL is not set.' +
          '\n    The in-memory implementation was verified; Postgres was not.\n',
      )
    }
    expect(implementations.length).toBeGreaterThanOrEqual(1)
  })
})
