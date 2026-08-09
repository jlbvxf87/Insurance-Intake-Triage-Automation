/**
 * Workflow run logging (FR-009, FR-012, FR-032, FR-034, NFR-007).
 *
 * Accumulates a step-by-step trace during a run and produces one
 * `AutomationLog` record at the end. The trace is what makes "no workflow step
 * fails silently" checkable rather than merely asserted: every step records an
 * outcome, including the ones that were deliberately skipped.
 */

import type {
  AutomationLog,
  AutomationStepRecord,
} from '../domain/types'
import type { AutomationRunStatus, WorkflowStep } from '../domain/enums'
import { newLogId, newRunId } from '../utils/ids'
import { nowIso } from '../utils/dates'

export const WORKFLOW_NAME = 'Insurance Submission Intake & Triage'

export class RunLogger {
  readonly runId: string
  readonly startedAt: string
  private readonly startedMs: number
  private readonly steps: AutomationStepRecord[] = []
  private stepStartedMs: number

  private failedStep: WorkflowStep | null = null
  private errorMessage: string | null = null
  private retryCount = 0

  constructor(runId: string = newRunId(), startedAt: string = nowIso()) {
    this.runId = runId
    this.startedAt = startedAt
    this.startedMs = Date.now()
    this.stepStartedMs = this.startedMs
  }

  /** Record a step that completed normally. */
  ok(step: WorkflowStep, detail: string): void {
    this.record(step, 'ok', detail)
  }

  /**
   * Record a step that was deliberately not run — for example extraction when
   * no document was supplied. A skip is an outcome, not an absence: the log
   * should show that the step was considered (AC-005).
   */
  skipped(step: WorkflowStep, detail: string): void {
    this.record(step, 'skipped', detail)
  }

  /** Record a step failure. The first failure is the one reported as `stepFailed`. */
  failed(step: WorkflowStep, detail: string, retries = 0): void {
    this.record(step, 'failed', detail)
    if (!this.failedStep) {
      this.failedStep = step
      this.errorMessage = detail
      this.retryCount = retries
    }
  }

  private record(
    step: WorkflowStep,
    outcome: AutomationStepRecord['outcome'],
    detail: string,
  ): void {
    const at = Date.now()
    this.steps.push({
      step,
      outcome,
      detail,
      at: new Date(at).toISOString(),
      durationMs: at - this.stepStartedMs,
    })
    this.stepStartedMs = at
  }

  get hasFailure(): boolean {
    return this.failedStep !== null
  }

  /** Finalize into a persistable log record. */
  finish(submissionId: string, status: AutomationRunStatus): AutomationLog {
    const completedMs = Date.now()
    return {
      logId: newLogId(),
      submissionId,
      workflowName: WORKFLOW_NAME,
      runId: this.runId,
      started: this.startedAt,
      completed: new Date(completedMs).toISOString(),
      status,
      stepFailed: this.failedStep,
      errorMessage: this.errorMessage,
      retryCount: this.retryCount,
      durationMs: completedMs - this.startedMs,
      steps: [...this.steps],
    }
  }
}

/**
 * Map a submission's terminal status onto a run status.
 *
 * Three run statuses rather than two: a run that correctly escalated to a
 * human *succeeded* as a workflow, and counting it as a failure would make the
 * automation-health panel read as though the system were broken every time it
 * did the right thing (FR-037).
 */
export function runStatusFor(submissionStatus: string): AutomationRunStatus {
  if (submissionStatus === 'Exception') return 'Failed'
  if (
    submissionStatus === 'In Review' ||
    submissionStatus === 'Duplicate'
  ) {
    return 'Needs Review'
  }
  return 'Succeeded'
}
