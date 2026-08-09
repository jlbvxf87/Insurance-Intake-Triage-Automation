/**
 * Regenerates sample-data/*.csv from the seed fixtures so the committed CSVs
 * and the running demo can never disagree.
 *
 *   node --experimental-strip-types scripts/generate-sample-data.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSeedData } from '../lib/data/seed'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../sample-data')
mkdirSync(out, { recursive: true })

// Fixed reference instant so regenerating the CSVs produces a stable diff.
const REFERENCE = new Date('2026-08-09T15:00:00.000Z')
const { clients, submissions, extractions } = createSeedData(REFERENCE)

const esc = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (headers: string[], rows: unknown[][]) =>
  [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n'

writeFileSync(
  resolve(out, 'clients.csv'),
  toCsv(
    ['clientId','clientName','companyName','email','phone','clientType','createdDate','active'],
    clients.map((c) => [c.clientId,c.clientName,c.companyName,c.email,c.phone,c.clientType,c.createdDate,c.active]),
  ),
)

writeFileSync(
  resolve(out, 'submissions.csv'),
  toCsv(
    ['submissionId','clientId','submissionType','lineOfBusiness','dateReceived','status','assignedTeam','duplicateFlag','confidenceScore','needsHumanReview','reviewReasons','source','originalDocument','description'],
    submissions.map((s) => [s.submissionId,s.clientId,s.submissionType,s.lineOfBusiness,s.dateReceived,s.status,s.assignedTeam,s.duplicateFlag,s.confidenceScore,s.needsHumanReview,s.reviewReasons.join('; '),s.source,s.originalDocument?.fileName ?? '',s.description]),
  ),
)

writeFileSync(
  resolve(out, 'extracted-policy-data.csv'),
  toCsv(
    ['extractionId','submissionId','carrier','policyNumber','namedInsured','policyType','effectiveDate','expirationDate','coverageAmount','extractionConfidence','validationStatus','missingFields','provider'],
    extractions.map((e) => [e.extractionId,e.submissionId,e.carrier,e.policyNumber,e.namedInsured,e.policyType,e.effectiveDate,e.expirationDate,e.coverageAmount,e.extractionConfidence.toFixed(3),e.validationStatus,e.missingFields.join('; '),e.provider]),
  ),
)

console.log(`clients: ${clients.length}  submissions: ${submissions.length}  extractions: ${extractions.length}`)
