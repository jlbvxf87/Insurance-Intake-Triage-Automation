import { describe, it, expect, beforeEach } from 'vitest'
import { runIntakeWorkflow } from '@/lib/workflow/orchestrator'
import { resolveTeam, resolveOutcome, ROUTING_RULES, detectPolicyTypeMismatch } from '@/lib/workflow/business-rules'
import { checkForDuplicate } from '@/lib/workflow/duplicate-detection'
import { buildConfirmation, shouldSendConfirmation } from '@/lib/workflow/notifications'
import { runStatusFor } from '@/lib/workflow/run-logger'
import { FailingExtractionAdapter } from '@/lib/extraction/fixture-adapter'
import { FailingRepository, InMemoryRepository } from '@/lib/data/memory-repository'
import { createSeedData } from '@/lib/data/seed'
import { LINES_OF_BUSINESS } from '@/lib/domain/enums'
import { daysAgo } from '@/lib/utils/dates'
import type { Submission } from '@/lib/domain/types'
import {
  NOW,
  documentNamed,
  freshRepository,
  instantExtractor,
  testConfig,
  validInput,
} from './helpers'

let repository: InMemoryRepository

beforeEach(() => {
  repository = freshRepository()
})

const run = (options: Partial<Parameters<typeof runIntakeWorkflow>[0]> = {}) =>
  runIntakeWorkflow({
    input: validInput(),
    document: null,
    repository,
    config: testConfig(),
    extractor: instantExtractor(),
    now: NOW,
    ...options,
  })

// ===========================================================================
// TC-01 — Valid quote submission
// ===========================================================================

describe('TC-01 · valid quote submission (AC-001)', () => {
  it('routes a clean submission and marks the run succeeded', async () => {
    const result = await run({
      input: validInput({ email: 'newclient@vancemachine2.example', lineOfBusiness: 'Property' }),
      document: documentNamed('northside-property.pdf'),
    })

    expect(result.status).toBe('Routed')
    expect(result.response.assignedTeam).toBe('Property Team')
    expect(result.response.needsHumanReview).toBe(false)
    expect(result.log.status).toBe('Succeeded')
    expect(result.log.stepFailed).toBeNull()
  })

  it('returns a submission reference to the submitter (FR-016)', async () => {
    const result = await run({ input: validInput({ email: 'ref@new-client.example' }) })
    expect(result.response.submissionId).toMatch(/^SUB-\d+$/)
  })

  it('persists the submission so it appears in the queue', async () => {
    const result = await run({ input: validInput({ email: 'persist@new-client.example' }) })
    const stored = await repository.getSubmission(result.submissionId)
    expect(stored?.status).toBe('Routed')
  })
})

// ===========================================================================
// TC-02 / TC-03 — Client matching
// ===========================================================================

describe('TC-02 · existing client match (AC-002)', () => {
  it('links to the existing client despite casing and whitespace differences', async () => {
    const before = (await repository.listClients()).length

    const result = await run({
      input: validInput({
        email: '  Dispatch@ACMETrucking.Example  ',
        lineOfBusiness: 'Property',
      }),
    })

    expect(result.client?.clientId).toBe('CLI-1001')
    expect((await repository.listClients()).length).toBe(before)
  })

  it('does not modify the existing client record (FR-019)', async () => {
    await run({
      input: validInput({
        email: 'Dispatch@ACMETrucking.Example',
        companyName: 'Something Entirely Different',
        lineOfBusiness: 'Property',
      }),
    })

    const client = await repository.getClient('CLI-1001')
    expect(client?.companyName).toBe('ACME Trucking LLC')
  })
})

describe('TC-03 · new client creation (AC-003)', () => {
  it('creates and links a client when no match exists', async () => {
    const before = (await repository.listClients()).length

    const result = await run({
      input: validInput({
        email: 'newbusiness@harborworks.example',
        companyName: 'Harbor Works Inc',
        lineOfBusiness: 'General Liability',
      }),
    })

    expect((await repository.listClients()).length).toBe(before + 1)
    expect(result.client?.email).toBe('newbusiness@harborworks.example')
    expect(result.status).toBe('Routed')
    expect(result.response.needsHumanReview).toBe(false)
  })

  it('stores the normalized email on the new client', async () => {
    const result = await run({
      input: validInput({ email: '  Mixed.Case@Harbor.Example ', lineOfBusiness: 'Property' }),
    })
    expect(result.client?.normalizedEmail).toBe('mixed.case@harbor.example')
  })
})

// ===========================================================================
// TC-04 — Duplicate detection
// ===========================================================================

describe('TC-04 · duplicate detection (AC-004)', () => {
  it('flags a repeat submission inside the window and routes it to review', async () => {
    const result = await run({ input: validInput() }) // ACME + Commercial Auto + Quote

    expect(result.response.duplicateFlag).toBe(true)
    expect(result.status).toBe('Duplicate')
    expect(result.response.needsHumanReview).toBe(true)
    expect(result.response.reviewReasons).toContain('Possible Duplicate')
    expect(result.submission?.duplicateReason).toMatch(/Same client/)
    expect(result.submission?.duplicateOfSubmissionId).toMatch(/^SUB-/)
  })

  it('states every matched condition and the window in the reason (FR-020)', async () => {
    const result = await run({ input: validInput() })
    const reason = result.submission?.duplicateReason ?? ''
    expect(reason).toMatch(/Quote/)
    expect(reason).toMatch(/Commercial Auto/)
    expect(reason).toMatch(/window: 30 days/)
  })

  it('never rejects or closes a duplicate (BR-016)', async () => {
    const result = await run({ input: validInput() })
    expect(result.status).not.toBe('Closed')
    expect(await repository.getSubmission(result.submissionId)).not.toBeNull()
  })

  it('TC-04b · does not flag when the prior submission is outside the window', async () => {
    // CLI-1006's only prior General Liability quote is ~13 days old, so the
    // same submission flags at a 30-day window and clears at a 5-day one.
    const kestrel = validInput({
      email: 'gosei@kestrelbenefit.example',
      lineOfBusiness: 'General Liability',
    })

    const inside = await run({ input: kestrel, config: testConfig({ duplicateWindowDays: 30 }) })
    expect(inside.response.duplicateFlag).toBe(true)

    repository = freshRepository()
    const outside = await run({ input: kestrel, config: testConfig({ duplicateWindowDays: 5 }) })
    expect(outside.response.duplicateFlag).toBe(false)
    expect(outside.status).toBe('Routed')
  })

  it('TC-04c · ignores prior submissions in Exception status (BR-015)', () => {
    const candidate: Submission = {
      ...createSeedData(new Date(NOW)).submissions[0],
      status: 'Exception',
      dateReceived: daysAgo(2, NOW),
      submissionType: 'Quote',
      lineOfBusiness: 'Commercial Auto',
    }

    const result = checkForDuplicate({
      candidates: [candidate],
      submissionType: 'Quote',
      lineOfBusiness: 'Commercial Auto',
      now: NOW,
      windowDays: 30,
    })

    expect(result.isDuplicate).toBe(false)
  })

  it('picks the most recent prior submission when several match', () => {
    const base = createSeedData(new Date(NOW)).submissions[0]
    const result = checkForDuplicate({
      candidates: [
        { ...base, submissionId: 'SUB-OLD', dateReceived: daysAgo(20, NOW), status: 'Routed' },
        { ...base, submissionId: 'SUB-NEW', dateReceived: daysAgo(2, NOW), status: 'Routed' },
      ],
      submissionType: base.submissionType,
      lineOfBusiness: base.lineOfBusiness,
      now: NOW,
      windowDays: 30,
    })

    expect(result.duplicateOfSubmissionId).toBe('SUB-NEW')
  })

  it('does not compare a submission against itself', () => {
    const base = createSeedData(new Date(NOW)).submissions[0]
    const result = checkForDuplicate({
      candidates: [{ ...base, submissionId: 'SUB-SELF', dateReceived: daysAgo(1, NOW), status: 'Routed' }],
      submissionType: base.submissionType,
      lineOfBusiness: base.lineOfBusiness,
      now: NOW,
      windowDays: 30,
      excludeSubmissionId: 'SUB-SELF',
    })
    expect(result.isDuplicate).toBe(false)
  })
})

// ===========================================================================
// TC-05 — Missing document
// ===========================================================================

describe('TC-05 · submission without a document (AC-005)', () => {
  it('completes normally with no extraction record', async () => {
    const result = await run({
      input: validInput({ email: 'nodoc@harborworks.example', lineOfBusiness: 'Property' }),
      document: null,
    })

    expect(result.status).toBe('Routed')
    expect(result.extraction).toBeNull()
    expect(result.response.confidenceScore).toBeNull()
    expect(result.response.needsHumanReview).toBe(false)
    expect(await repository.getExtractionBySubmission(result.submissionId)).toBeNull()
  })

  it('records the skip rather than omitting the step (NFR-007)', async () => {
    const result = await run({
      input: validInput({ email: 'nodoc2@harborworks.example', lineOfBusiness: 'Property' }),
    })
    const step = result.log.steps.find((s) => s.step === 'Extract Document')
    expect(step?.outcome).toBe('skipped')
    expect(step?.detail).toMatch(/No document supplied/)
  })
})

// ===========================================================================
// TC-06 — Confidence threshold
// ===========================================================================

describe('TC-06 · low-confidence extraction (AC-006)', () => {
  it('retains the values, marks them unverified, and routes to review', async () => {
    const result = await run({
      input: validInput({
        email: 'lowconf@belmontfab2.example',
        lineOfBusiness: 'Workers Compensation',
      }),
      document: documentNamed('low-confidence-scan.pdf'),
    })

    expect(result.status).toBe('In Review')
    expect(result.response.needsHumanReview).toBe(true)
    expect(result.response.reviewReasons).toContain('Low Confidence')
    expect(result.extraction?.validationStatus).toBe('Unverified')
    expect(result.extraction?.policyNumber).toBe('WC-55120-B')
    expect(result.response.confidenceScore).toBeCloseTo(0.62, 2)
  })

  it('retains per-field confidence so the weak field is identifiable (BR-018)', async () => {
    const result = await run({
      input: validInput({ email: 'fields@belmontfab3.example', lineOfBusiness: 'Workers Compensation' }),
      document: documentNamed('low-confidence-scan.pdf'),
    })
    expect(result.extraction?.fieldConfidence.policyNumber).toBeCloseTo(0.48, 2)
  })

  it('TC-06b · treats the threshold as inclusive', async () => {
    const result = await run({
      input: validInput({ email: 'boundary@lakeline2.example', lineOfBusiness: 'Property' }),
      document: documentNamed('boundary.pdf'),
      config: testConfig({ confidenceThreshold: 0.8 }),
    })

    expect(result.response.confidenceScore).toBe(0.8)
    expect(result.extraction?.validationStatus).toBe('Validated')
    expect(result.status).toBe('Routed')
  })

  it('respects a raised threshold without a code change (BR-017)', async () => {
    const result = await run({
      input: validInput({ email: 'strict@lakeline3.example', lineOfBusiness: 'Property' }),
      document: documentNamed('lakeline-dec-page.pdf'),
      config: testConfig({ confidenceThreshold: 0.99 }),
    })
    expect(result.status).toBe('In Review')
    expect(result.response.reviewReasons).toContain('Low Confidence')
  })
})

// ===========================================================================
// TC-08 — Extraction failures
// ===========================================================================

describe('TC-08 · extraction failure (AC-008)', () => {
  const cases = [
    ['service_error', 'TC-08 · service error'],
    ['timeout', 'TC-08b · timeout'],
    ['malformed_response', 'TC-08c · malformed response'],
  ] as const

  for (const [kind, label] of cases) {
    it(`${label} routes to the exception queue and logs the failing step`, async () => {
      const result = await run({
        input: validInput({ email: `fail-${kind}@harborworks.example`, lineOfBusiness: 'Property' }),
        document: documentNamed('anything.pdf'),
        extractor: new FailingExtractionAdapter(kind, `Simulated ${kind}.`),
      })

      expect(result.status).toBe('Exception')
      expect(result.log.status).toBe('Failed')
      expect(result.log.stepFailed).toBe('Extract Document')
      expect(result.log.errorMessage).toMatch(new RegExp(kind))
      expect(result.response.needsHumanReview).toBe(true)
    })
  }

  it('preserves the submission and its form data (AC-008)', async () => {
    const result = await run({
      input: validInput({ email: 'preserve@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('anything.pdf'),
      extractor: new FailingExtractionAdapter('service_error'),
    })

    const stored = await repository.getSubmission(result.submissionId)
    expect(stored).not.toBeNull()
    expect(stored?.description).toBe(validInput().description)
    expect(stored?.originalDocument?.fileName).toBe('anything.pdf')
  })

  it('leaves an exception unassigned rather than routing it to a team', async () => {
    const result = await run({
      input: validInput({ email: 'unassigned@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('anything.pdf'),
      extractor: new FailingExtractionAdapter('timeout'),
    })
    expect(result.response.assignedTeam).toBe('Unassigned')
  })

  it('sends no confirmation on an exception (AC-011)', async () => {
    const result = await run({
      input: validInput({ email: 'noconfirm@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('anything.pdf'),
      extractor: new FailingExtractionAdapter('service_error'),
    })
    expect(result.confirmation).toBeNull()
  })

  it('is reachable through the fixture adapter for demonstration', async () => {
    const result = await run({
      input: validInput({ email: 'trigger@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('trigger-timeout.pdf'),
    })
    expect(result.status).toBe('Exception')
  })
})

// ===========================================================================
// TC-09 / TC-10 — Routing
// ===========================================================================

describe('TC-10 · deterministic routing (AC-010)', () => {
  it('maps every known line of business to its documented team', () => {
    expect(ROUTING_RULES).toEqual({
      'Commercial Auto': 'Auto Team',
      Property: 'Property Team',
      'General Liability': 'Casualty Team',
      'Workers Compensation': 'WC Team',
      Other: 'General Intake',
    })
  })

  it('produces an identical assignment on repeat evaluation', () => {
    for (const lob of LINES_OF_BUSINESS) {
      const first = resolveTeam(lob)
      const second = resolveTeam(lob)
      expect(first).toEqual(second)
      expect(first.matched).toBe(true)
    }
  })

  it('routes each line of business end to end', async () => {
    for (const [index, lob] of LINES_OF_BUSINESS.entries()) {
      const repo = freshRepository(false)
      const result = await runIntakeWorkflow({
        input: validInput({ email: `route${index}@harborworks.example`, lineOfBusiness: lob }),
        document: null,
        repository: repo,
        config: testConfig(),
        extractor: instantExtractor(),
        now: NOW,
      })
      expect(result.response.assignedTeam).toBe(ROUTING_RULES[lob])
      expect(result.status).toBe('Routed')
    }
  })

  it('does not let an extracted policy type override the routing rule (FR-030)', async () => {
    // The fixture for this file name extracts policyType "Workers Compensation"
    // while the submitter selected Property.
    const result = await run({
      input: validInput({ email: 'mismatch@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('low-confidence-scan.pdf'),
    })

    expect(result.response.assignedTeam).toBe('Property Team')
    expect(result.response.reviewReasons).toContain('Policy Type Mismatch')
  })

  it('detects a mismatch only when the policy type implies a different line', () => {
    expect(detectPolicyTypeMismatch('Property', 'Commercial Property')).toBe(false)
    expect(detectPolicyTypeMismatch('Property', 'Commercial Auto')).toBe(true)
    expect(detectPolicyTypeMismatch('Property', 'Unknown')).toBe(false)
    expect(detectPolicyTypeMismatch('Property', 'Umbrella')).toBe(false)
  })
})

describe('TC-09 · unknown routing rule (AC-009)', () => {
  it('falls back to General Intake and flags for review', () => {
    const decision = resolveTeam('Marine Cargo')
    expect(decision.team).toBe('General Intake')
    expect(decision.matched).toBe(false)
  })

  it('produces In Review with the unknown-routing reason', () => {
    const outcome = resolveOutcome({
      hasWorkflowError: false,
      isPossibleDuplicate: false,
      isLowConfidence: false,
      hasMissingRequiredData: false,
      hasUnknownRouting: true,
      hasPolicyTypeMismatch: false,
    })
    expect(outcome.status).toBe('In Review')
    expect(outcome.needsHumanReview).toBe(true)
    expect(outcome.reviewReasons).toContain('Unknown Routing Rule')
  })
})

// ===========================================================================
// TC-13 — Missing required extracted field
// ===========================================================================

describe('TC-13 · missing required extracted field (AC-013)', () => {
  it('marks the extraction failed, names the field, and routes to review', async () => {
    const result = await run({
      input: validInput({ email: 'partial@riverbend2.example' }),
      document: documentNamed('riverbend-partial-dec.pdf'),
    })

    expect(result.extraction?.validationStatus).toBe('Failed')
    expect(result.extraction?.missingFields).toContain('policyNumber')
    expect(result.status).toBe('In Review')
    expect(result.response.reviewReasons).toContain('Missing Required Data')
  })

  it('retains the fields that were extracted (FR-024)', async () => {
    const result = await run({
      input: validInput({ email: 'partial2@riverbend3.example' }),
      document: documentNamed('riverbend-partial-dec.pdf'),
    })
    expect(result.extraction?.namedInsured).toBe('Riverbend Logistics')
    expect(result.extraction?.carrier).toBe('Ridgeline Indemnity')
  })
})

// ===========================================================================
// TC-14 — Write failure
// ===========================================================================

describe('TC-14 · record write failure (AC-014)', () => {
  it('catches a submission write failure and ends in Exception', async () => {
    const failing = new FailingRepository(
      'createSubmission',
      'Simulated data store failure.',
      createSeedData(new Date(NOW)),
    )

    const result = await runIntakeWorkflow({
      input: validInput({ email: 'writefail@harborworks.example' }),
      document: null,
      repository: failing,
      config: testConfig(),
      extractor: instantExtractor(),
      now: NOW,
    })

    expect(result.status).toBe('Exception')
    expect(result.log.status).toBe('Failed')
    expect(result.log.errorMessage).toMatch(/Simulated data store failure/)
  })

  it('does not let an exception escape the orchestrator', async () => {
    const failing = new FailingRepository(
      'createClient',
      'Client store unavailable.',
      createSeedData(new Date(NOW)),
    )

    await expect(
      runIntakeWorkflow({
        input: validInput({ email: 'brandnew@harborworks.example' }),
        document: null,
        repository: failing,
        config: testConfig(),
        extractor: instantExtractor(),
        now: NOW,
      }),
    ).resolves.toBeDefined()
  })

  it('never leaves a submission in Processing (NFR-005)', async () => {
    const failing = new FailingRepository(
      'createExtraction',
      'Extraction store unavailable.',
      createSeedData(new Date(NOW)),
    )

    const result = await runIntakeWorkflow({
      input: validInput({ email: 'stuck@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('lakeline-dec-page.pdf'),
      repository: failing,
      config: testConfig(),
      extractor: instantExtractor(),
      now: NOW,
    })

    const stored = await failing.getSubmission(result.submissionId)
    expect(result.status).not.toBe('Processing')
    expect(stored?.status).not.toBe('Processing')
  })
})

// ===========================================================================
// TC-15 — Precedence
// ===========================================================================

describe('TC-15 · concurrent exception conditions (AC-015)', () => {
  it('statuses a duplicate + low-confidence submission as Duplicate with both reasons', () => {
    const outcome = resolveOutcome({
      hasWorkflowError: false,
      isPossibleDuplicate: true,
      isLowConfidence: true,
      hasMissingRequiredData: false,
      hasUnknownRouting: false,
      hasPolicyTypeMismatch: false,
    })

    expect(outcome.status).toBe('Duplicate')
    expect(outcome.reviewReasons).toEqual(
      expect.arrayContaining(['Possible Duplicate', 'Low Confidence']),
    )
  })

  it('gives a workflow error the highest precedence', () => {
    const outcome = resolveOutcome({
      hasWorkflowError: true,
      isPossibleDuplicate: true,
      isLowConfidence: true,
      hasMissingRequiredData: true,
      hasUnknownRouting: true,
      hasPolicyTypeMismatch: true,
    })
    expect(outcome.status).toBe('Exception')
    expect(outcome.reviewReasons.length).toBe(6)
  })

  it('returns Routed with no reasons when nothing applies', () => {
    const outcome = resolveOutcome({
      hasWorkflowError: false,
      isPossibleDuplicate: false,
      isLowConfidence: false,
      hasMissingRequiredData: false,
      hasUnknownRouting: false,
      hasPolicyTypeMismatch: false,
    })
    expect(outcome).toEqual({ status: 'Routed', needsHumanReview: false, reviewReasons: [] })
  })

  it('flags duplicate and low confidence together end to end', async () => {
    const result = await run({
      input: validInput({
        email: 'Dispatch@ACMETrucking.Example',
        lineOfBusiness: 'Commercial Auto',
      }),
      document: documentNamed('low-confidence-scan.pdf'),
    })

    expect(result.status).toBe('Duplicate')
    expect(result.response.reviewReasons).toEqual(
      expect.arrayContaining(['Possible Duplicate', 'Low Confidence']),
    )
  })
})

// ===========================================================================
// TC-11 — Confirmation
// ===========================================================================

describe('TC-11 · submitter confirmation (AC-011)', () => {
  it('emits an acknowledgement on successful routing', async () => {
    const result = await run({
      input: validInput({ email: 'confirm@harborworks.example', lineOfBusiness: 'Property' }),
    })

    expect(result.confirmation).not.toBeNull()
    expect(result.confirmation?.toEmail).toBe('confirm@harborworks.example')
    expect(result.confirmation?.assignedTeam).toBe('Property Team')
    expect(result.confirmation?.body).toContain(result.submissionId)
    expect(result.confirmation?.body).toContain('Property Team')
  })

  it('records the confirmation on the run (FR-031)', async () => {
    const result = await run({
      input: validInput({ email: 'confirm2@harborworks.example', lineOfBusiness: 'Property' }),
    })
    const step = result.log.steps.find((s) => s.step === 'Send Confirmation')
    expect(step?.outcome).toBe('ok')
  })

  it('sends nothing for review and duplicate outcomes', () => {
    expect(shouldSendConfirmation('Routed')).toBe(true)
    expect(shouldSendConfirmation('In Review')).toBe(false)
    expect(shouldSendConfirmation('Duplicate')).toBe(false)
    expect(shouldSendConfirmation('Exception')).toBe(false)
  })

  it('builds a subject and body containing the reference', () => {
    const event = buildConfirmation({
      submissionId: 'SUB-99999',
      toEmail: 'a@b.example',
      toName: 'Alex',
      assignedTeam: 'Auto Team',
      submissionType: 'Quote',
      lineOfBusiness: 'Commercial Auto',
      transport: 'log',
      at: NOW,
    })
    expect(event.subject).toContain('SUB-99999')
    expect(event.body).toContain('Auto Team')
    expect(event.transport).toBe('log')
  })
})

// ===========================================================================
// TC-12 — Logging
// ===========================================================================

describe('TC-12 · automation log (AC-012)', () => {
  it('writes exactly one log per run, whatever the outcome', async () => {
    const scenarios = [
      { email: 'log1@harborworks.example', document: null, extractor: instantExtractor() },
      { email: 'log2@harborworks.example', document: documentNamed('low-confidence-scan.pdf'), extractor: instantExtractor() },
      { email: 'log3@harborworks.example', document: documentNamed('x.pdf'), extractor: new FailingExtractionAdapter('service_error') },
    ]

    for (const scenario of scenarios) {
      const result = await run({
        input: validInput({ email: scenario.email, lineOfBusiness: 'Property' }),
        document: scenario.document,
        extractor: scenario.extractor,
      })
      const logs = await repository.listLogsBySubmission(result.submissionId)
      expect(logs.length).toBe(1)
    }
  })

  it('records run id, timestamps, and duration', async () => {
    const result = await run({
      input: validInput({ email: 'timing@harborworks.example', lineOfBusiness: 'Property' }),
    })

    expect(result.log.runId).toMatch(/^run_/)
    expect(result.log.started).toBeTruthy()
    expect(result.log.completed).toBeTruthy()
    expect(result.log.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.log.workflowName).toBe('Insurance Submission Intake & Triage')
  })

  it('traces every step attempted (NFR-007)', async () => {
    const result = await run({
      input: validInput({ email: 'trace@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('lakeline-dec-page.pdf'),
    })

    const steps = result.log.steps.map((s) => s.step)
    expect(steps).toEqual([
      'Validate Submission',
      'Resolve Client',
      'Duplicate Check',
      'Extract Document',
      'Validate Extraction',
      'Apply Business Rules',
      'Persist Records',
      'Send Confirmation',
    ])
    for (const step of result.log.steps) {
      expect(step.detail.length).toBeGreaterThan(0)
    }
  })

  it('counts an escalation as Needs Review, not Failed (FR-037)', () => {
    expect(runStatusFor('Routed')).toBe('Succeeded')
    expect(runStatusFor('In Review')).toBe('Needs Review')
    expect(runStatusFor('Duplicate')).toBe('Needs Review')
    expect(runStatusFor('Exception')).toBe('Failed')
  })

  it('records the retry count reported by the adapter', async () => {
    const result = await run({
      input: validInput({ email: 'retries@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('trigger-error.pdf'),
    })
    expect(result.log.retryCount).toBe(2) // 3 attempts = 2 retries
  })
})

// ===========================================================================
// Isolation
// ===========================================================================

describe('workflow isolation (NFR-006)', () => {
  it('does not let a failing submission affect the next one', async () => {
    const failed = await run({
      input: validInput({ email: 'first@harborworks.example', lineOfBusiness: 'Property' }),
      document: documentNamed('x.pdf'),
      extractor: new FailingExtractionAdapter('service_error'),
    })

    const succeeded = await run({
      input: validInput({ email: 'second@harborworks.example', lineOfBusiness: 'Property' }),
    })

    expect(failed.status).toBe('Exception')
    expect(succeeded.status).toBe('Routed')
    expect(succeeded.submissionId).not.toBe(failed.submissionId)
  })
})
