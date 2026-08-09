import 'server-only'

import postgres from 'postgres'
import type {
  AutomationLog,
  AutomationStepRecord,
  Client,
  ExtractedPolicyData,
  Submission,
  SubmissionDetail,
} from '../domain/types'
import type {
  AssignedTeam,
  ClientType,
  ExtractionProvider,
  LineOfBusiness,
  PolicyType,
  ReviewReason,
  SubmissionSource,
  SubmissionStatus,
  SubmissionType,
  ValidationStatus,
  WorkflowStep,
} from '../domain/enums'
import { type DuplicateQuery, type Repository, RepositoryError } from './repository'

/**
 * Postgres-backed repository (IR-005).
 *
 * This is the claim the `Repository` interface was making, cashed in: the
 * orchestrator is unchanged, the tests are unchanged, the business rules are
 * unchanged. Only the thing behind the interface is different.
 *
 * **Why a direct Postgres connection rather than PostgREST.** The tables live
 * in a dedicated `iit` schema that is deliberately *not* exposed through the
 * Supabase API, so the anon key reaches nothing even by accident. It also
 * keeps the SQL visible, which suits a project whose subject is data modeling.
 *
 * **Why the pooler.** Serverless functions scale to many short-lived
 * instances, and each one opening a direct Postgres connection would exhaust
 * the server's connection limit under any real load. The transaction-mode
 * pooler is designed for exactly this shape, with two consequences the client
 * has to respect: prepared statements are unavailable (`prepare: false`), and
 * each instance should hold a single connection (`max: 1`).
 */

type Sql = ReturnType<typeof postgres>

let client: Sql | undefined

declare global {
  var __iitSql: Sql | undefined
}

/**
 * One connection per process, cached on `globalThis` so Next.js hot reloads in
 * development do not leak a new pool on every edit.
 */
function getSql(connectionString: string): Sql {
  if (globalThis.__iitSql) return globalThis.__iitSql

  client = postgres(connectionString, {
    // Transaction-mode pooling does not support prepared statements.
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // The demo carries no sensitive payloads, but there is no reason for
    // query text to reach a log sink either.
    onnotice: () => {},
  })

  globalThis.__iitSql = client
  return client
}

// ---------------------------------------------------------------------------
// Row types and mapping
// ---------------------------------------------------------------------------

interface ClientRow {
  client_id: string
  client_name: string
  company_name: string
  email: string
  normalized_email: string
  phone: string
  client_type: string
  created_date: Date
  active: boolean
}

interface SubmissionRow {
  submission_id: string
  client_id: string
  submission_type: string
  line_of_business: string
  description: string
  date_received: Date
  status: string
  assigned_team: string
  duplicate_flag: boolean
  duplicate_reason: string | null
  duplicate_of_submission_id: string | null
  confidence_score: string | null
  needs_human_review: boolean
  review_reasons: string[]
  source: string
  original_document: Submission['originalDocument']
}

interface ExtractionRow {
  extraction_id: string
  submission_id: string
  carrier: string | null
  policy_number: string | null
  effective_date: Date | null
  expiration_date: Date | null
  named_insured: string | null
  policy_type: string
  coverage_amount: string | null
  extraction_confidence: string
  field_confidence: Record<string, number>
  validation_status: string
  missing_fields: string[]
  provider: string
  extracted_at: Date
}

interface LogRow {
  log_id: string
  submission_id: string
  workflow_name: string
  run_id: string
  started: Date
  completed: Date | null
  duration_ms: number | null
  status: string
  step_failed: string | null
  error_message: string | null
  retry_count: number
  steps: AutomationStepRecord[]
}

const iso = (value: Date) => new Date(value).toISOString()
const isoOrNull = (value: Date | null) => (value ? new Date(value).toISOString() : null)
/** Postgres returns `numeric` as a string to avoid float precision loss. */
const num = (value: string | null) => (value === null ? null : Number(value))
const dateOnly = (value: Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : null

function toClient(row: ClientRow): Client {
  return {
    clientId: row.client_id,
    clientName: row.client_name,
    companyName: row.company_name,
    email: row.email,
    normalizedEmail: row.normalized_email,
    phone: row.phone,
    clientType: row.client_type as ClientType,
    createdDate: iso(row.created_date),
    active: row.active,
  }
}

function toSubmission(row: SubmissionRow): Submission {
  return {
    submissionId: row.submission_id,
    clientId: row.client_id,
    submissionType: row.submission_type as SubmissionType,
    lineOfBusiness: row.line_of_business as LineOfBusiness,
    description: row.description,
    dateReceived: iso(row.date_received),
    status: row.status as SubmissionStatus,
    assignedTeam: row.assigned_team as AssignedTeam,
    duplicateFlag: row.duplicate_flag,
    duplicateReason: row.duplicate_reason,
    duplicateOfSubmissionId: row.duplicate_of_submission_id,
    confidenceScore: num(row.confidence_score),
    needsHumanReview: row.needs_human_review,
    reviewReasons: row.review_reasons as ReviewReason[],
    source: row.source as SubmissionSource,
    originalDocument: row.original_document,
  }
}

function toExtraction(row: ExtractionRow): ExtractedPolicyData {
  return {
    extractionId: row.extraction_id,
    submissionId: row.submission_id,
    carrier: row.carrier,
    policyNumber: row.policy_number,
    effectiveDate: dateOnly(row.effective_date),
    expirationDate: dateOnly(row.expiration_date),
    namedInsured: row.named_insured,
    policyType: row.policy_type as PolicyType,
    coverageAmount: num(row.coverage_amount),
    extractionConfidence: Number(row.extraction_confidence),
    fieldConfidence: row.field_confidence ?? {},
    validationStatus: row.validation_status as ValidationStatus,
    missingFields: row.missing_fields ?? [],
    provider: row.provider as ExtractionProvider,
    extractedAt: iso(row.extracted_at),
  }
}

function toLog(row: LogRow): AutomationLog {
  return {
    logId: row.log_id,
    submissionId: row.submission_id,
    workflowName: row.workflow_name,
    runId: row.run_id,
    started: iso(row.started),
    completed: isoOrNull(row.completed),
    durationMs: row.duration_ms,
    status: row.status as AutomationLog['status'],
    stepFailed: row.step_failed as WorkflowStep | null,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    steps: row.steps ?? [],
  }
}

/** Wraps a driver error so the orchestrator classifies it as a write failure (BR-011). */
async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw new RepositoryError(
      error instanceof Error ? error.message : String(error),
      operation,
      error,
    )
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class PostgresRepository implements Repository {
  private readonly sql: Sql

  constructor(connectionString: string) {
    this.sql = getSql(connectionString)
  }

  // -- Client --------------------------------------------------------------

  async findClientByNormalizedEmail(normalizedEmail: string): Promise<Client | null> {
    return guard('findClientByNormalizedEmail', async () => {
      const rows = await this.sql<ClientRow[]>`
        select * from iit.clients where normalized_email = ${normalizedEmail} limit 1
      `
      return rows[0] ? toClient(rows[0]) : null
    })
  }

  async getClient(clientId: string): Promise<Client | null> {
    return guard('getClient', async () => {
      const rows = await this.sql<ClientRow[]>`
        select * from iit.clients where client_id = ${clientId} limit 1
      `
      return rows[0] ? toClient(rows[0]) : null
    })
  }

  async createClient(client: Client): Promise<Client> {
    return guard('createClient', async () => {
      const rows = await this.sql<ClientRow[]>`
        insert into iit.clients (
          client_id, client_name, company_name, email, normalized_email,
          phone, client_type, created_date, active
        ) values (
          ${client.clientId}, ${client.clientName}, ${client.companyName},
          ${client.email}, ${client.normalizedEmail}, ${client.phone},
          ${client.clientType}, ${client.createdDate}, ${client.active}
        )
        returning *
      `
      return toClient(rows[0])
    })
  }

  async listClients(): Promise<Client[]> {
    return guard('listClients', async () => {
      const rows = await this.sql<ClientRow[]>`
        select * from iit.clients order by created_date desc
      `
      return rows.map(toClient)
    })
  }

  // -- Submission ----------------------------------------------------------

  async createSubmission(submission: Submission): Promise<Submission> {
    return guard('createSubmission', async () => {
      const rows = await this.sql<SubmissionRow[]>`
        insert into iit.submissions (
          submission_id, client_id, submission_type, line_of_business, description,
          date_received, status, assigned_team, duplicate_flag, duplicate_reason,
          duplicate_of_submission_id, confidence_score, needs_human_review,
          review_reasons, source, original_document
        ) values (
          ${submission.submissionId}, ${submission.clientId}, ${submission.submissionType},
          ${submission.lineOfBusiness}, ${submission.description}, ${submission.dateReceived},
          ${submission.status}, ${submission.assignedTeam}, ${submission.duplicateFlag},
          ${submission.duplicateReason}, ${submission.duplicateOfSubmissionId},
          ${submission.confidenceScore}, ${submission.needsHumanReview},
          ${this.sql.array(submission.reviewReasons)}, ${submission.source},
          ${this.sql.json(submission.originalDocument as never)}
        )
        returning *
      `
      return toSubmission(rows[0])
    })
  }

  async updateSubmission(
    submissionId: string,
    patch: Partial<Submission>,
  ): Promise<Submission> {
    return guard('updateSubmission', async () => {
      // Only the fields the workflow actually updates. An open-ended column
      // mapper would let a typo silently write nothing.
      const rows = await this.sql<SubmissionRow[]>`
        update iit.submissions set
          status                     = coalesce(${patch.status ?? null}, status),
          assigned_team              = coalesce(${patch.assignedTeam ?? null}, assigned_team),
          duplicate_flag             = coalesce(${patch.duplicateFlag ?? null}, duplicate_flag),
          duplicate_reason           = ${patch.duplicateReason !== undefined ? patch.duplicateReason : this.sql`duplicate_reason`},
          duplicate_of_submission_id = ${patch.duplicateOfSubmissionId !== undefined ? patch.duplicateOfSubmissionId : this.sql`duplicate_of_submission_id`},
          confidence_score           = ${patch.confidenceScore !== undefined ? patch.confidenceScore : this.sql`confidence_score`},
          needs_human_review         = coalesce(${patch.needsHumanReview ?? null}, needs_human_review),
          review_reasons             = ${patch.reviewReasons !== undefined ? this.sql.array(patch.reviewReasons) : this.sql`review_reasons`}
        where submission_id = ${submissionId}
        returning *
      `

      if (!rows[0]) {
        throw new Error(`Submission ${submissionId} not found.`)
      }
      return toSubmission(rows[0])
    })
  }

  async getSubmission(submissionId: string): Promise<Submission | null> {
    return guard('getSubmission', async () => {
      const rows = await this.sql<SubmissionRow[]>`
        select * from iit.submissions where submission_id = ${submissionId} limit 1
      `
      return rows[0] ? toSubmission(rows[0]) : null
    })
  }

  async listSubmissions(): Promise<Submission[]> {
    return guard('listSubmissions', async () => {
      const rows = await this.sql<SubmissionRow[]>`
        select * from iit.submissions order by date_received desc
      `
      return rows.map(toSubmission)
    })
  }

  async findDuplicateCandidates(query: DuplicateQuery): Promise<Submission[]> {
    return guard('findDuplicateCandidates', async () => {
      // The time window and the Exception exclusion are applied by the
      // duplicate detector, not here — the repository answers "what exists",
      // the rules decide what it means. Matches the OData filter documented in
      // power-automate/expressions.md §2.
      const rows = await this.sql<SubmissionRow[]>`
        select * from iit.submissions
        where client_id        = ${query.clientId}
          and submission_type  = ${query.submissionType}
          and line_of_business = ${query.lineOfBusiness}
        order by date_received desc
      `
      return rows.map(toSubmission)
    })
  }

  // -- Extraction ----------------------------------------------------------

  async createExtraction(extraction: ExtractedPolicyData): Promise<ExtractedPolicyData> {
    return guard('createExtraction', async () => {
      const rows = await this.sql<ExtractionRow[]>`
        insert into iit.extracted_policy_data (
          extraction_id, submission_id, carrier, policy_number, effective_date,
          expiration_date, named_insured, policy_type, coverage_amount,
          extraction_confidence, field_confidence, validation_status,
          missing_fields, provider, extracted_at
        ) values (
          ${extraction.extractionId}, ${extraction.submissionId}, ${extraction.carrier},
          ${extraction.policyNumber}, ${extraction.effectiveDate}, ${extraction.expirationDate},
          ${extraction.namedInsured}, ${extraction.policyType}, ${extraction.coverageAmount},
          ${extraction.extractionConfidence}, ${this.sql.json(extraction.fieldConfidence)},
          ${extraction.validationStatus}, ${this.sql.array(extraction.missingFields)},
          ${extraction.provider}, ${extraction.extractedAt}
        )
        returning *
      `
      return toExtraction(rows[0])
    })
  }

  async getExtractionBySubmission(
    submissionId: string,
  ): Promise<ExtractedPolicyData | null> {
    return guard('getExtractionBySubmission', async () => {
      const rows = await this.sql<ExtractionRow[]>`
        select * from iit.extracted_policy_data where submission_id = ${submissionId} limit 1
      `
      return rows[0] ? toExtraction(rows[0]) : null
    })
  }

  async updateExtraction(
    extractionId: string,
    patch: Partial<ExtractedPolicyData>,
  ): Promise<ExtractedPolicyData> {
    return guard('updateExtraction', async () => {
      const rows = await this.sql<ExtractionRow[]>`
        update iit.extracted_policy_data set
          carrier           = coalesce(${patch.carrier ?? null}, carrier),
          policy_number     = coalesce(${patch.policyNumber ?? null}, policy_number),
          named_insured     = coalesce(${patch.namedInsured ?? null}, named_insured),
          effective_date    = coalesce(${patch.effectiveDate ?? null}, effective_date),
          expiration_date   = coalesce(${patch.expirationDate ?? null}, expiration_date),
          coverage_amount   = coalesce(${patch.coverageAmount ?? null}, coverage_amount),
          validation_status = coalesce(${patch.validationStatus ?? null}, validation_status),
          missing_fields    = ${patch.missingFields !== undefined ? this.sql.array(patch.missingFields) : this.sql`missing_fields`}
        where extraction_id = ${extractionId}
        returning *
      `

      if (!rows[0]) {
        throw new Error(`Extraction ${extractionId} not found.`)
      }
      return toExtraction(rows[0])
    })
  }

  // -- Automation log ------------------------------------------------------

  async createLog(log: AutomationLog): Promise<AutomationLog> {
    return guard('createLog', async () => {
      const rows = await this.sql<LogRow[]>`
        insert into iit.automation_logs (
          log_id, submission_id, workflow_name, run_id, started, completed,
          duration_ms, status, step_failed, error_message, retry_count, steps
        ) values (
          ${log.logId}, ${log.submissionId}, ${log.workflowName}, ${log.runId},
          ${log.started}, ${log.completed}, ${log.durationMs}, ${log.status},
          ${log.stepFailed}, ${log.errorMessage}, ${log.retryCount},
          ${this.sql.json(log.steps as never)}
        )
        returning *
      `
      return toLog(rows[0])
    })
  }

  async updateLog(logId: string, patch: Partial<AutomationLog>): Promise<AutomationLog> {
    return guard('updateLog', async () => {
      const rows = await this.sql<LogRow[]>`
        update iit.automation_logs set
          completed     = coalesce(${patch.completed ?? null}, completed),
          duration_ms   = coalesce(${patch.durationMs ?? null}, duration_ms),
          status        = coalesce(${patch.status ?? null}, status),
          step_failed   = coalesce(${patch.stepFailed ?? null}, step_failed),
          error_message = coalesce(${patch.errorMessage ?? null}, error_message),
          retry_count   = coalesce(${patch.retryCount ?? null}, retry_count)
        where log_id = ${logId}
        returning *
      `
      if (!rows[0]) throw new Error(`Log ${logId} not found.`)
      return toLog(rows[0])
    })
  }

  async listLogs(): Promise<AutomationLog[]> {
    return guard('listLogs', async () => {
      const rows = await this.sql<LogRow[]>`
        select * from iit.automation_logs order by started desc
      `
      return rows.map(toLog)
    })
  }

  async listLogsBySubmission(submissionId: string): Promise<AutomationLog[]> {
    return guard('listLogsBySubmission', async () => {
      const rows = await this.sql<LogRow[]>`
        select * from iit.automation_logs
        where submission_id = ${submissionId}
        order by started desc
      `
      return rows.map(toLog)
    })
  }

  // -- Views ---------------------------------------------------------------

  async getSubmissionDetail(submissionId: string): Promise<SubmissionDetail | null> {
    const submission = await this.getSubmission(submissionId)
    if (!submission) return null

    const [client, extraction, logs] = await Promise.all([
      this.getClient(submission.clientId),
      this.getExtractionBySubmission(submissionId),
      this.listLogsBySubmission(submissionId),
    ])

    return client ? { submission, client, extraction, logs } : null
  }

  async listSubmissionDetails(): Promise<SubmissionDetail[]> {
    return guard('listSubmissionDetails', async () => {
      // Four queries and an in-memory join rather than a query per submission.
      // The dashboard renders every open submission, so an N+1 here would be
      // dozens of round trips on a cold serverless instance.
      const [clients, submissions, extractions, logs] = await Promise.all([
        this.sql<ClientRow[]>`select * from iit.clients`,
        this.sql<SubmissionRow[]>`select * from iit.submissions order by date_received desc`,
        this.sql<ExtractionRow[]>`select * from iit.extracted_policy_data`,
        this.sql<LogRow[]>`select * from iit.automation_logs order by started desc`,
      ])

      const clientById = new Map(clients.map((row) => [row.client_id, toClient(row)]))
      const extractionBySubmission = new Map(
        extractions.map((row) => [row.submission_id, toExtraction(row)]),
      )

      const logsBySubmission = new Map<string, AutomationLog[]>()
      for (const row of logs) {
        const list = logsBySubmission.get(row.submission_id) ?? []
        list.push(toLog(row))
        logsBySubmission.set(row.submission_id, list)
      }

      const details: SubmissionDetail[] = []
      for (const row of submissions) {
        const submission = toSubmission(row)
        const client = clientById.get(submission.clientId)
        if (!client) continue
        details.push({
          submission,
          client,
          extraction: extractionBySubmission.get(submission.submissionId) ?? null,
          logs: logsBySubmission.get(submission.submissionId) ?? [],
        })
      }

      return details
    })
  }

  // -- Maintenance ---------------------------------------------------------

  /**
   * Truncate every table. Used by the scheduled demo reset.
   *
   * `restart identity cascade` in one statement rather than four deletes: the
   * foreign keys are Restrict and Cascade, so ordering deletes by hand would
   * be a correctness problem waiting to happen.
   */
  async truncateAll(): Promise<void> {
    await guard('truncateAll', async () => {
      await this.sql`
        truncate table
          iit.automation_logs,
          iit.extracted_policy_data,
          iit.submissions,
          iit.clients
        restart identity cascade
      `
    })
  }

  /** True when the store holds no clients — i.e. it has never been seeded. */
  async isEmpty(): Promise<boolean> {
    return guard('isEmpty', async () => {
      const rows = await this.sql<{ count: number }[]>`
        select count(*)::int as count from iit.clients
      `
      return rows[0].count === 0
    })
  }

  /**
   * Run `work` while holding a session-level advisory lock.
   *
   * Serverless cold starts are concurrent: several instances can decide the
   * database looks empty at the same instant and all try to seed it. A
   * Postgres advisory lock is the cheapest correct answer — no extra table, no
   * extra round trip when uncontended. An instance that cannot take the lock
   * returns `null` rather than waiting, because another instance is already
   * doing the work.
   *
   * Session-level rather than transaction-level so the seeding statements run
   * on the same pooled connection without nesting inside a transaction.
   */
  async withAdvisoryLock<T>(key: number, work: () => Promise<T>): Promise<T | null> {
    const rows = await this.sql<{ locked: boolean }[]>`
      select pg_try_advisory_lock(${key}) as locked
    `
    if (!rows[0]?.locked) return null

    try {
      return await work()
    } finally {
      await this.sql`select pg_advisory_unlock(${key})`
    }
  }

  /** Cheap liveness probe for the health endpoint. */
  async ping(): Promise<boolean> {
    try {
      await this.sql`select 1`
      return true
    } catch {
      return false
    }
  }
}
