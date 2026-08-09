/**
 * Repository interface (IR-005).
 *
 * The orchestrator depends on this interface, never on a concrete store. Three
 * consequences, each of them the point:
 *
 *  - A Dataverse implementation can replace the in-memory one without the
 *    workflow changing.
 *  - Write failures are testable by injecting a repository that throws
 *    (AC-014), rather than by breaking real persistence.
 *  - The workflow can be exercised with no database, so the public demo runs
 *    from a clean clone.
 */

import type {
  AutomationLog,
  Client,
  ExtractedPolicyData,
  Submission,
  SubmissionDetail,
} from '../domain/types'

export interface DuplicateQuery {
  clientId: string
  submissionType: Submission['submissionType']
  lineOfBusiness: Submission['lineOfBusiness']
}

export interface Repository {
  // Client -----------------------------------------------------------------
  findClientByNormalizedEmail(normalizedEmail: string): Promise<Client | null>
  getClient(clientId: string): Promise<Client | null>
  createClient(client: Client): Promise<Client>
  listClients(): Promise<Client[]>

  // Submission -------------------------------------------------------------
  createSubmission(submission: Submission): Promise<Submission>
  updateSubmission(
    submissionId: string,
    patch: Partial<Submission>,
  ): Promise<Submission>
  getSubmission(submissionId: string): Promise<Submission | null>
  listSubmissions(): Promise<Submission[]>

  /**
   * Candidates for duplicate evaluation: same client, same type, same line of
   * business. The time-window rule (BR-013) and the exclusion of `Exception`
   * submissions (BR-015) are applied by the duplicate detector, not here — the
   * repository answers "what exists", the rules decide what it means.
   */
  findDuplicateCandidates(query: DuplicateQuery): Promise<Submission[]>

  // Extraction -------------------------------------------------------------
  createExtraction(extraction: ExtractedPolicyData): Promise<ExtractedPolicyData>
  getExtractionBySubmission(
    submissionId: string,
  ): Promise<ExtractedPolicyData | null>
  updateExtraction(
    extractionId: string,
    patch: Partial<ExtractedPolicyData>,
  ): Promise<ExtractedPolicyData>

  // Automation log ---------------------------------------------------------
  createLog(log: AutomationLog): Promise<AutomationLog>
  updateLog(logId: string, patch: Partial<AutomationLog>): Promise<AutomationLog>
  listLogs(): Promise<AutomationLog[]>
  listLogsBySubmission(submissionId: string): Promise<AutomationLog[]>

  // Views ------------------------------------------------------------------
  getSubmissionDetail(submissionId: string): Promise<SubmissionDetail | null>
  listSubmissionDetails(): Promise<SubmissionDetail[]>
}

/** Raised on a persistence failure so the orchestrator can classify it (BR-011). */
export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly operation: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}
