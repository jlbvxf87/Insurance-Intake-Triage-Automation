/**
 * Emits INSERT statements for the synthetic dataset.
 *
 *   npx tsx scripts/generate-seed-sql.mts > /tmp/seed.sql
 *
 * Used to load a fresh database without needing the app running. The scheduled
 * reset at /api/admin/reset does the same thing through the Repository
 * interface; this exists for first-run bootstrap and for inspecting exactly
 * what would be written.
 */
import { createSeedData } from '../lib/data/seed'

const data = createSeedData(new Date())

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return `'${String(v).replace(/'/g, "''")}'`
}
const arr = (v: string[]): string =>
  v.length === 0 ? `'{}'` : `array[${v.map(q).join(', ')}]::text[]`
const json = (v: unknown): string => (v === null ? 'null' : `${q(JSON.stringify(v))}::jsonb`)

const out: string[] = ['begin;', '']

out.push('truncate table iit.automation_logs, iit.extracted_policy_data, iit.submissions, iit.clients restart identity cascade;', '')

for (const c of data.clients) {
  out.push(
    `insert into iit.clients (client_id, client_name, company_name, email, normalized_email, phone, client_type, created_date, active) values (${[
      q(c.clientId), q(c.clientName), q(c.companyName), q(c.email), q(c.normalizedEmail),
      q(c.phone), q(c.clientType), q(c.createdDate), q(c.active),
    ].join(', ')});`,
  )
}
out.push('')

// Self-reference is applied afterwards, so submissions can be inserted in any order.
for (const s of data.submissions) {
  out.push(
    `insert into iit.submissions (submission_id, client_id, submission_type, line_of_business, description, date_received, status, assigned_team, duplicate_flag, duplicate_reason, duplicate_of_submission_id, confidence_score, needs_human_review, review_reasons, source, original_document) values (${[
      q(s.submissionId), q(s.clientId), q(s.submissionType), q(s.lineOfBusiness),
      q(s.description), q(s.dateReceived), q(s.status), q(s.assignedTeam),
      q(s.duplicateFlag), q(s.duplicateReason), 'null', q(s.confidenceScore),
      q(s.needsHumanReview), arr(s.reviewReasons), q(s.source), json(s.originalDocument),
    ].join(', ')});`,
  )
}
out.push('')

for (const s of data.submissions) {
  if (s.duplicateOfSubmissionId) {
    out.push(
      `update iit.submissions set duplicate_of_submission_id = ${q(s.duplicateOfSubmissionId)} where submission_id = ${q(s.submissionId)};`,
    )
  }
}
out.push('')

for (const e of data.extractions) {
  out.push(
    `insert into iit.extracted_policy_data (extraction_id, submission_id, carrier, policy_number, effective_date, expiration_date, named_insured, policy_type, coverage_amount, extraction_confidence, field_confidence, validation_status, missing_fields, provider, extracted_at) values (${[
      q(e.extractionId), q(e.submissionId), q(e.carrier), q(e.policyNumber),
      q(e.effectiveDate), q(e.expirationDate), q(e.namedInsured), q(e.policyType),
      q(e.coverageAmount), e.extractionConfidence.toFixed(3), json(e.fieldConfidence),
      q(e.validationStatus), arr(e.missingFields), q(e.provider), q(e.extractedAt),
    ].join(', ')});`,
  )
}
out.push('')

for (const l of data.logs) {
  out.push(
    `insert into iit.automation_logs (log_id, submission_id, workflow_name, run_id, started, completed, duration_ms, status, step_failed, error_message, retry_count, steps) values (${[
      q(l.logId), q(l.submissionId), q(l.workflowName), q(l.runId), q(l.started),
      q(l.completed), q(l.durationMs), q(l.status), q(l.stepFailed), q(l.errorMessage),
      q(l.retryCount), json(l.steps),
    ].join(', ')});`,
  )
}

out.push('', 'commit;')
console.log(out.join('\n'))
