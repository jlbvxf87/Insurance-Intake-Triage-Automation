import { describe, it, expect, beforeEach } from 'vitest'
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
  InvalidTransitionError,
  isAwaitingHuman,
  isTerminal,
} from '@/lib/workflow/state-machine'
import { applyReviewAction } from '@/lib/workflow/review'
import { runIntakeWorkflow } from '@/lib/workflow/orchestrator'
import { SUBMISSION_STATUSES } from '@/lib/domain/enums'
import type { InMemoryRepository } from '@/lib/data/memory-repository'
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

describe('state machine', () => {
  it('declares a transition list for every status', () => {
    for (const status of SUBMISSION_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined()
    }
  })

  it('permits only the documented transitions out of Processing', () => {
    expect([...ALLOWED_TRANSITIONS.Processing].sort()).toEqual(
      ['Duplicate', 'Exception', 'In Review', 'Routed'].sort(),
    )
  })

  it('treats Closed as terminal', () => {
    expect(isTerminal('Closed')).toBe(true)
    expect(canTransition('Closed', 'Routed')).toBe(false)
  })

  it('rejects an Exception moving straight to Closed only if undeclared', () => {
    // Exception -> Closed IS allowed (an operator can close it), but
    // Closed -> anything is not.
    expect(canTransition('Exception', 'Closed')).toBe(true)
    expect(canTransition('Closed', 'In Review')).toBe(false)
  })

  it('throws a message naming the allowed targets', () => {
    try {
      assertTransition('Closed', 'Routed')
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError)
      expect((error as Error).message).toMatch(/terminal state/)
    }
  })

  it('identifies the statuses awaiting a person', () => {
    expect(isAwaitingHuman('In Review')).toBe(true)
    expect(isAwaitingHuman('Duplicate')).toBe(true)
    expect(isAwaitingHuman('Exception')).toBe(true)
    expect(isAwaitingHuman('Routed')).toBe(false)
    expect(isAwaitingHuman('Closed')).toBe(false)
  })

  it('never allows a status to transition to Processing except New and Exception', () => {
    for (const status of SUBMISSION_STATUSES) {
      const allowed = ALLOWED_TRANSITIONS[status].includes('Processing')
      expect(allowed).toBe(status === 'New' || status === 'Exception')
    }
  })
})

describe('human review actions (FR-010, FR-011)', () => {
  async function submitForReview() {
    return runIntakeWorkflow({
      input: validInput({
        email: 'review@harborworks.example',
        lineOfBusiness: 'Workers Compensation',
      }),
      document: documentNamed('low-confidence-scan.pdf'),
      repository,
      config: testConfig(),
      extractor: instantExtractor(),
      now: NOW,
    })
  }

  it('release applies routing rules and clears the review flags', async () => {
    const submitted = await submitForReview()
    expect(submitted.status).toBe('In Review')

    const result = await applyReviewAction({
      submissionId: submitted.submissionId,
      action: { type: 'release', note: 'Policy number confirmed against the carrier portal.' },
      repository,
      actor: 'j.baston',
      now: NOW,
    })

    expect(result.submission.status).toBe('Routed')
    expect(result.submission.assignedTeam).toBe('WC Team')
    expect(result.submission.needsHumanReview).toBe(false)
    expect(result.submission.reviewReasons).toEqual([])
  })

  it('release sends the submitter a confirmation', async () => {
    const submitted = await submitForReview()
    const result = await applyReviewAction({
      submissionId: submitted.submissionId,
      action: { type: 'release' },
      repository,
      actor: 'j.baston',
      now: NOW,
    })

    expect(result.confirmation?.toEmail).toBe('review@harborworks.example')
    expect(result.confirmation?.assignedTeam).toBe('WC Team')
  })

  it('logs the actor and what changed', async () => {
    const submitted = await submitForReview()
    const result = await applyReviewAction({
      submissionId: submitted.submissionId,
      action: { type: 'release', note: 'Confirmed with the client.' },
      repository,
      actor: 'j.baston',
      now: NOW,
    })

    expect(result.log.workflowName).toMatch(/Human Review/)
    expect(result.log.steps[0].detail).toMatch(/j\.baston/)
    expect(result.log.steps[0].detail).toMatch(/Confirmed with the client/)

    const logs = await repository.listLogsBySubmission(submitted.submissionId)
    expect(logs.length).toBe(2) // the automated run, then the review action
  })

  it('correcting extracted data validates it without releasing the submission', async () => {
    const submitted = await submitForReview()

    const result = await applyReviewAction({
      submissionId: submitted.submissionId,
      action: {
        type: 'correct-extraction',
        corrections: { policyNumber: 'WC-55120-B-CORRECTED' },
      },
      repository,
      actor: 'j.baston',
      now: NOW,
    })

    const extraction = await repository.getExtractionBySubmission(submitted.submissionId)
    expect(extraction?.policyNumber).toBe('WC-55120-B-CORRECTED')
    expect(extraction?.validationStatus).toBe('Validated')
    // Correcting is not releasing — those are separate deliberate acts.
    expect(result.submission.status).toBe('In Review')
  })

  it('preserves the model confidence after a correction', async () => {
    const submitted = await submitForReview()
    const before = await repository.getExtractionBySubmission(submitted.submissionId)

    await applyReviewAction({
      submissionId: submitted.submissionId,
      action: { type: 'correct-extraction', corrections: { carrier: 'Granite State' } },
      repository,
      actor: 'j.baston',
      now: NOW,
    })

    const after = await repository.getExtractionBySubmission(submitted.submissionId)
    expect(after?.extractionConfidence).toBe(before?.extractionConfidence)
  })

  it('dismissing a duplicate clears the flag and routes', async () => {
    const duplicate = await runIntakeWorkflow({
      input: validInput(), // ACME + Commercial Auto → duplicate of a seeded submission
      document: null,
      repository,
      config: testConfig(),
      extractor: instantExtractor(),
      now: NOW,
    })
    expect(duplicate.status).toBe('Duplicate')

    const result = await applyReviewAction({
      submissionId: duplicate.submissionId,
      action: { type: 'dismiss-duplicate', note: 'Different vehicle schedule.' },
      repository,
      actor: 'j.baston',
      now: NOW,
    })

    expect(result.submission.status).toBe('Routed')
    expect(result.submission.duplicateFlag).toBe(false)
    expect(result.submission.duplicateReason).toBeNull()
    expect(result.submission.assignedTeam).toBe('Auto Team')
  })

  it('confirming a duplicate closes it and keeps the reason', async () => {
    const duplicate = await runIntakeWorkflow({
      input: validInput(),
      document: null,
      repository,
      config: testConfig(),
      extractor: instantExtractor(),
      now: NOW,
    })

    const result = await applyReviewAction({
      submissionId: duplicate.submissionId,
      action: { type: 'confirm-duplicate' },
      repository,
      actor: 'j.baston',
      now: NOW,
    })

    expect(result.submission.status).toBe('Closed')
    expect(result.submission.duplicateReason).toMatch(/Same client/)
  })

  it('refuses an action that would make an invalid transition', async () => {
    const submitted = await submitForReview()
    await applyReviewAction({
      submissionId: submitted.submissionId,
      action: { type: 'close' },
      repository,
      actor: 'j.baston',
      now: NOW,
    })

    await expect(
      applyReviewAction({
        submissionId: submitted.submissionId,
        action: { type: 'release' },
        repository,
        actor: 'j.baston',
        now: NOW,
      }),
    ).rejects.toThrow(InvalidTransitionError)
  })

  it('refuses to act on a submission that does not exist', async () => {
    await expect(
      applyReviewAction({
        submissionId: 'SUB-00000',
        action: { type: 'close' },
        repository,
        actor: 'j.baston',
      }),
    ).rejects.toThrow(/not found/)
  })

  it('refuses to correct an extraction that does not exist', async () => {
    const submitted = await runIntakeWorkflow({
      input: validInput({ email: 'nodoc-review@harborworks.example', lineOfBusiness: 'Property' }),
      document: null,
      repository,
      config: testConfig(),
      extractor: instantExtractor(),
      now: NOW,
    })

    await expect(
      applyReviewAction({
        submissionId: submitted.submissionId,
        action: { type: 'correct-extraction', corrections: { carrier: 'X' } },
        repository,
        actor: 'j.baston',
      }),
    ).rejects.toThrow(/No extraction record/)
  })
})
