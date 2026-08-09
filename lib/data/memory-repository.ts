/**
 * In-memory repository (D-002).
 *
 * The default store for the public demonstration. Data resets when the server
 * restarts — a stated property of the demo, not a hidden one.
 *
 * Every method returns a structural clone so a caller cannot mutate stored
 * state by holding a reference to a returned object. That is the behaviour a
 * real data source has, and the workflow should not accidentally depend on the
 * looser semantics of a shared object graph.
 */

import type {
  AutomationLog,
  Client,
  ExtractedPolicyData,
  Submission,
  SubmissionDetail,
} from '../domain/types'
import { type DuplicateQuery, type Repository, RepositoryError } from './repository'

const clone = <T>(value: T): T => structuredClone(value)

export class InMemoryRepository implements Repository {
  private clients = new Map<string, Client>()
  private submissions = new Map<string, Submission>()
  private extractions = new Map<string, ExtractedPolicyData>()
  private logs = new Map<string, AutomationLog>()

  constructor(seed?: {
    clients?: Client[]
    submissions?: Submission[]
    extractions?: ExtractedPolicyData[]
    logs?: AutomationLog[]
  }) {
    seed?.clients?.forEach((c) => this.clients.set(c.clientId, clone(c)))
    seed?.submissions?.forEach((s) => this.submissions.set(s.submissionId, clone(s)))
    seed?.extractions?.forEach((e) => this.extractions.set(e.extractionId, clone(e)))
    seed?.logs?.forEach((l) => this.logs.set(l.logId, clone(l)))
  }

  // Client -----------------------------------------------------------------

  async findClientByNormalizedEmail(normalizedEmail: string): Promise<Client | null> {
    for (const client of this.clients.values()) {
      if (client.normalizedEmail === normalizedEmail) return clone(client)
    }
    return null
  }

  async getClient(clientId: string): Promise<Client | null> {
    const found = this.clients.get(clientId)
    return found ? clone(found) : null
  }

  async createClient(client: Client): Promise<Client> {
    if (this.clients.has(client.clientId)) {
      throw new RepositoryError(
        `Client ${client.clientId} already exists.`,
        'createClient',
      )
    }

    // Mirrors the alternate key on `normalized_email` (FR-017, FR-019).
    // Without this the in-memory store would accept a duplicate that Postgres
    // rejects — and the repository contract test caught exactly that. A stand-in
    // that enforces less than the real thing hides bugs until production.
    for (const existing of this.clients.values()) {
      if (existing.normalizedEmail === client.normalizedEmail) {
        throw new RepositoryError(
          `A client already exists for ${client.normalizedEmail} (${existing.clientId}).`,
          'createClient',
        )
      }
    }

    this.clients.set(client.clientId, clone(client))
    return clone(client)
  }

  async listClients(): Promise<Client[]> {
    return [...this.clients.values()].map(clone)
  }

  // Submission -------------------------------------------------------------

  async createSubmission(submission: Submission): Promise<Submission> {
    this.submissions.set(submission.submissionId, clone(submission))
    return clone(submission)
  }

  async updateSubmission(
    submissionId: string,
    patch: Partial<Submission>,
  ): Promise<Submission> {
    const existing = this.submissions.get(submissionId)
    if (!existing) {
      throw new RepositoryError(
        `Submission ${submissionId} not found.`,
        'updateSubmission',
      )
    }
    const updated = { ...existing, ...clone(patch), submissionId }
    this.submissions.set(submissionId, updated)
    return clone(updated)
  }

  async getSubmission(submissionId: string): Promise<Submission | null> {
    const found = this.submissions.get(submissionId)
    return found ? clone(found) : null
  }

  async listSubmissions(): Promise<Submission[]> {
    return [...this.submissions.values()]
      .map(clone)
      .sort((a, b) => b.dateReceived.localeCompare(a.dateReceived))
  }

  async findDuplicateCandidates(query: DuplicateQuery): Promise<Submission[]> {
    return [...this.submissions.values()]
      .filter(
        (s) =>
          s.clientId === query.clientId &&
          s.submissionType === query.submissionType &&
          s.lineOfBusiness === query.lineOfBusiness,
      )
      .map(clone)
      .sort((a, b) => b.dateReceived.localeCompare(a.dateReceived))
  }

  // Extraction -------------------------------------------------------------

  async createExtraction(extraction: ExtractedPolicyData): Promise<ExtractedPolicyData> {
    if (this.extractions.has(extraction.extractionId)) {
      throw new RepositoryError(
        `Extraction ${extraction.extractionId} already exists.`,
        'createExtraction',
      )
    }

    // Mirrors the alternate key enforcing 1:1 with Submission (DR-003).
    for (const existing of this.extractions.values()) {
      if (existing.submissionId === extraction.submissionId) {
        throw new RepositoryError(
          `Submission ${extraction.submissionId} already has extraction ${existing.extractionId}.`,
          'createExtraction',
        )
      }
    }

    this.extractions.set(extraction.extractionId, clone(extraction))
    return clone(extraction)
  }

  async getExtractionBySubmission(
    submissionId: string,
  ): Promise<ExtractedPolicyData | null> {
    for (const extraction of this.extractions.values()) {
      if (extraction.submissionId === submissionId) return clone(extraction)
    }
    return null
  }

  async updateExtraction(
    extractionId: string,
    patch: Partial<ExtractedPolicyData>,
  ): Promise<ExtractedPolicyData> {
    const existing = this.extractions.get(extractionId)
    if (!existing) {
      throw new RepositoryError(
        `Extraction ${extractionId} not found.`,
        'updateExtraction',
      )
    }
    const updated = { ...existing, ...clone(patch), extractionId }
    this.extractions.set(extractionId, updated)
    return clone(updated)
  }

  // Automation log ---------------------------------------------------------

  async createLog(log: AutomationLog): Promise<AutomationLog> {
    this.logs.set(log.logId, clone(log))
    return clone(log)
  }

  async updateLog(logId: string, patch: Partial<AutomationLog>): Promise<AutomationLog> {
    const existing = this.logs.get(logId)
    if (!existing) {
      throw new RepositoryError(`Log ${logId} not found.`, 'updateLog')
    }
    const updated = { ...existing, ...clone(patch), logId }
    this.logs.set(logId, updated)
    return clone(updated)
  }

  async listLogs(): Promise<AutomationLog[]> {
    return [...this.logs.values()]
      .map(clone)
      .sort((a, b) => b.started.localeCompare(a.started))
  }

  async listLogsBySubmission(submissionId: string): Promise<AutomationLog[]> {
    return (await this.listLogs()).filter((l) => l.submissionId === submissionId)
  }

  // Views ------------------------------------------------------------------

  async getSubmissionDetail(submissionId: string): Promise<SubmissionDetail | null> {
    const submission = await this.getSubmission(submissionId)
    if (!submission) return null

    const client = await this.getClient(submission.clientId)
    if (!client) return null

    return {
      submission,
      client,
      extraction: await this.getExtractionBySubmission(submissionId),
      logs: await this.listLogsBySubmission(submissionId),
    }
  }

  async listSubmissionDetails(): Promise<SubmissionDetail[]> {
    const submissions = await this.listSubmissions()
    const details: SubmissionDetail[] = []

    for (const submission of submissions) {
      const client = await this.getClient(submission.clientId)
      if (!client) continue
      details.push({
        submission,
        client,
        extraction: await this.getExtractionBySubmission(submission.submissionId),
        logs: await this.listLogsBySubmission(submission.submissionId),
      })
    }

    return details
  }
}

/**
 * Repository that fails a chosen operation. Used to exercise the write-failure
 * path (AC-014, TC-14) without disabling any production code.
 */
export class FailingRepository extends InMemoryRepository {
  constructor(
    private readonly failOn: keyof Repository,
    private readonly message = 'Simulated data store failure.',
    seed?: ConstructorParameters<typeof InMemoryRepository>[0],
  ) {
    super(seed)
  }

  private guard(operation: keyof Repository): void {
    if (operation === this.failOn) {
      throw new RepositoryError(this.message, operation)
    }
  }

  override async createSubmission(submission: Submission): Promise<Submission> {
    this.guard('createSubmission')
    return super.createSubmission(submission)
  }

  override async updateSubmission(
    submissionId: string,
    patch: Partial<Submission>,
  ): Promise<Submission> {
    this.guard('updateSubmission')
    return super.updateSubmission(submissionId, patch)
  }

  override async createClient(client: Client): Promise<Client> {
    this.guard('createClient')
    return super.createClient(client)
  }

  override async createExtraction(
    extraction: ExtractedPolicyData,
  ): Promise<ExtractedPolicyData> {
    this.guard('createExtraction')
    return super.createExtraction(extraction)
  }
}
