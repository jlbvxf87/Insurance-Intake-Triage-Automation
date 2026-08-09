/**
 * Synthetic seed data (DR-007).
 *
 * Every record here is invented. Company names use the `.example` reserved
 * domain so no address in this repository can resolve to a real mailbox, and
 * policy numbers follow plausible carrier conventions without belonging to any
 * carrier.
 *
 * Records are generated *relative to a reference time* rather than pinned to
 * fixed dates, so the operations dashboard always shows a realistic mix of
 * "today", "this week", and "older" no matter when the project is run. The
 * reference time is a parameter, which is what makes seeded state
 * deterministic in tests.
 */

import type {
  AutomationLog,
  Client,
  ExtractedPolicyData,
  Submission,
} from '../domain/types'
import type {
  AssignedTeam,
  LineOfBusiness,
  ReviewReason,
  SubmissionStatus,
  SubmissionType,
  ValidationStatus,
} from '../domain/enums'
import { normalizeEmail } from '../utils/normalize'
import { seedCounter } from '../utils/ids'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const iso = (base: number, offsetMs: number) => new Date(base - offsetMs).toISOString()

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

interface ClientSpec {
  id: string
  contact: string
  company: string
  email: string
  phone: string
  type: Client['clientType']
  createdDaysAgo: number
  active?: boolean
}

const CLIENT_SPECS: ClientSpec[] = [
  {
    id: 'CLI-1001',
    contact: 'Dana Whitfield',
    company: 'ACME Trucking LLC',
    email: 'dispatch@acmetrucking.example',
    phone: '(816) 555-0142',
    type: 'Commercial',
    createdDaysAgo: 412,
  },
  {
    id: 'CLI-1002',
    contact: 'Marcus Reyes',
    company: 'Northside Property Group',
    email: 'mreyes@northsideproperty.example',
    phone: '(913) 555-0178',
    type: 'Commercial',
    createdDaysAgo: 288,
  },
  {
    id: 'CLI-1003',
    contact: 'Priya Raman',
    company: 'Belmont Fabrication Co',
    email: 'p.raman@belmontfab.example',
    phone: '(816) 555-0119',
    type: 'Commercial',
    createdDaysAgo: 197,
  },
  {
    id: 'CLI-1004',
    contact: 'Alan Novak',
    company: 'Riverbend Logistics',
    email: 'anovak@riverbendlogistics.example',
    phone: '(573) 555-0163',
    type: 'Commercial',
    createdDaysAgo: 154,
  },
  {
    id: 'CLI-1005',
    contact: 'Teresa Iglesias',
    company: 'Cedar Hollow Restaurants',
    email: 'tiglesias@cedarhollow.example',
    phone: '(816) 555-0134',
    type: 'Commercial',
    createdDaysAgo: 96,
  },
  {
    id: 'CLI-1006',
    contact: 'Gregory Osei',
    company: 'Kestrel Benefit Partners',
    email: 'gosei@kestrelbenefit.example',
    phone: '(913) 555-0107',
    type: 'Broker',
    createdDaysAgo: 61,
  },
  {
    id: 'CLI-1007',
    contact: 'Hollis Vance',
    company: 'Vance Machine Works',
    email: 'hollis@vancemachine.example',
    phone: '(660) 555-0186',
    type: 'Commercial',
    createdDaysAgo: 33,
  },
  {
    id: 'CLI-1008',
    contact: 'Sofia Barrantes',
    company: 'Lakeline Storage Partners',
    email: 'sbarrantes@lakelinestorage.example',
    phone: '(816) 555-0195',
    type: 'Commercial',
    createdDaysAgo: 12,
  },
]

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

interface SubmissionSpec {
  id: string
  clientId: string
  type: SubmissionType
  lob: LineOfBusiness
  description: string
  hoursAgo: number
  status: SubmissionStatus
  team: AssignedTeam
  needsReview?: boolean
  reviewReasons?: ReviewReason[]
  duplicateOf?: string
  duplicateReason?: string
  confidence?: number | null
  document?: { fileName: string; mimeType: string; sizeBytes: number }
  /** Populated when the seeded run produced an extraction record. */
  extraction?: {
    carrier: string
    policyNumber: string
    namedInsured: string
    effectiveDate: string
    expirationDate: string
    policyType: ExtractedPolicyData['policyType']
    coverageAmount: number
    validationStatus: ValidationStatus
    fieldConfidence: Record<string, number>
    missingFields?: string[]
  }
  /** Failure recorded on the run, for Exception-status rows. */
  failure?: { step: AutomationLog['stepFailed']; message: string; retries?: number }
}

const pdf = (fileName: string, sizeBytes: number) => ({
  fileName,
  mimeType: 'application/pdf',
  sizeBytes,
})

const SUBMISSION_SPECS: SubmissionSpec[] = [
  // ---- Today -------------------------------------------------------------
  {
    id: 'SUB-10024',
    clientId: 'CLI-1008',
    type: 'Quote',
    lob: 'Property',
    description:
      'New location added at 4400 Lakeline Rd. Requesting property coverage quote for the additional building and contents.',
    hoursAgo: 1,
    status: 'Routed',
    team: 'Property Team',
    confidence: 0.93,
    document: pdf('lakeline-dec-page.pdf', 284_119),
    extraction: {
      carrier: 'Meridian Mutual',
      policyNumber: 'PR-4471902',
      namedInsured: 'Lakeline Storage Partners',
      effectiveDate: '2026-03-01',
      expirationDate: '2027-03-01',
      policyType: 'Commercial Property',
      coverageAmount: 2_500_000,
      validationStatus: 'Validated',
      fieldConfidence: {
        namedInsured: 0.97,
        policyNumber: 0.95,
        carrier: 0.94,
        effectiveDate: 0.9,
        expirationDate: 0.89,
        coverageAmount: 0.92,
      },
    },
  },
  {
    id: 'SUB-10023',
    clientId: 'CLI-1001',
    type: 'Quote',
    lob: 'Commercial Auto',
    description:
      'Adding six tractors and four trailers to the fleet ahead of the Q3 contract. Requesting revised commercial auto quote.',
    hoursAgo: 2,
    status: 'Duplicate',
    team: 'Auto Team',
    needsReview: true,
    reviewReasons: ['Possible Duplicate'],
    duplicateOf: 'SUB-10019',
    duplicateReason:
      'Same client, same submission type (Quote), same line of business (Commercial Auto), previous submission received 4 days ago (window: 30 days).',
    confidence: 0.94,
    document: pdf('acme-fleet-schedule.pdf', 412_880),
    extraction: {
      carrier: 'Example Insurance',
      policyNumber: 'CA-829103',
      namedInsured: 'ACME Trucking LLC',
      effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01',
      policyType: 'Commercial Auto',
      coverageAmount: 1_000_000,
      validationStatus: 'Validated',
      fieldConfidence: {
        namedInsured: 0.98,
        policyNumber: 0.96,
        carrier: 0.93,
        effectiveDate: 0.91,
        expirationDate: 0.9,
        coverageAmount: 0.94,
      },
    },
  },
  {
    id: 'SUB-10022',
    clientId: 'CLI-1003',
    type: 'Claim',
    lob: 'Workers Compensation',
    description:
      'Employee sustained a hand injury operating a press brake on 6 August. Reported to supervisor same day. Requesting claim setup.',
    hoursAgo: 3,
    status: 'In Review',
    team: 'WC Team',
    needsReview: true,
    reviewReasons: ['Low Confidence'],
    confidence: 0.62,
    document: pdf('belmont-incident-scan.pdf', 1_902_441),
    extraction: {
      carrier: 'Granite State Casualty',
      policyNumber: 'WC-55120-B',
      namedInsured: 'Belmont Fabrication Co',
      effectiveDate: '2026-02-15',
      expirationDate: '2027-02-15',
      policyType: 'Workers Compensation',
      coverageAmount: 1_000_000,
      validationStatus: 'Unverified',
      fieldConfidence: {
        namedInsured: 0.71,
        policyNumber: 0.48,
        carrier: 0.66,
        effectiveDate: 0.59,
        expirationDate: 0.55,
        coverageAmount: 0.73,
      },
    },
  },
  {
    id: 'SUB-10021',
    clientId: 'CLI-1005',
    type: 'Quote',
    lob: 'General Liability',
    description:
      'Opening a third location with a patio bar area. Need general liability quote including liquor liability discussion.',
    hoursAgo: 5,
    status: 'Routed',
    team: 'Casualty Team',
    confidence: null,
  },
  {
    id: 'SUB-10020',
    clientId: 'CLI-1007',
    type: 'Quote',
    lob: 'Property',
    description:
      'Renewal quote for the Sedalia shop building. Roof was replaced in April, documentation attached.',
    hoursAgo: 7,
    status: 'Exception',
    team: 'Unassigned',
    needsReview: true,
    reviewReasons: ['Extraction Failure'],
    confidence: null,
    document: pdf('vance-roof-cert.pdf', 3_310_775),
    failure: {
      step: 'Extract Document',
      message:
        'Document Intelligence request failed: 503 Service Unavailable after 2 retries.',
      retries: 2,
    },
  },

  // ---- Yesterday and this week -------------------------------------------
  {
    id: 'SUB-10019',
    clientId: 'CLI-1001',
    type: 'Quote',
    lob: 'Commercial Auto',
    description:
      'Fleet expansion quote request. Adding units for the new regional route.',
    hoursAgo: 4 * 24 + 3,
    status: 'Routed',
    team: 'Auto Team',
    confidence: 0.95,
    document: pdf('acme-dec-page.pdf', 268_004),
    extraction: {
      carrier: 'Example Insurance',
      policyNumber: 'CA-829103',
      namedInsured: 'ACME Trucking LLC',
      effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01',
      policyType: 'Commercial Auto',
      coverageAmount: 1_000_000,
      validationStatus: 'Validated',
      fieldConfidence: {
        namedInsured: 0.98,
        policyNumber: 0.97,
        carrier: 0.95,
        effectiveDate: 0.93,
        expirationDate: 0.92,
        coverageAmount: 0.95,
      },
    },
  },
  {
    id: 'SUB-10018',
    clientId: 'CLI-1006',
    type: 'Quote',
    lob: 'Other',
    description:
      'Broker request on behalf of a manufacturing client seeking cyber liability. Not a standard line for this desk.',
    hoursAgo: 26,
    status: 'In Review',
    team: 'General Intake',
    needsReview: true,
    reviewReasons: ['Unknown Routing Rule'],
    confidence: null,
  },
  {
    id: 'SUB-10017',
    clientId: 'CLI-1002',
    type: 'Claim',
    lob: 'Property',
    description:
      'Water damage in the basement level of the Elmwood building following a supply line failure on 2 August.',
    hoursAgo: 30,
    status: 'Routed',
    team: 'Property Team',
    confidence: 0.88,
    document: pdf('northside-loss-notice.pdf', 512_338),
    extraction: {
      carrier: 'Meridian Mutual',
      policyNumber: 'PR-3390188',
      namedInsured: 'Northside Property Group',
      effectiveDate: '2025-11-01',
      expirationDate: '2026-11-01',
      policyType: 'Commercial Property',
      coverageAmount: 4_000_000,
      validationStatus: 'Validated',
      fieldConfidence: {
        namedInsured: 0.93,
        policyNumber: 0.88,
        carrier: 0.86,
        effectiveDate: 0.87,
        expirationDate: 0.85,
        coverageAmount: 0.89,
      },
    },
  },
  {
    id: 'SUB-10016',
    clientId: 'CLI-1004',
    type: 'Quote',
    lob: 'Commercial Auto',
    description:
      'Requesting quote for two new box trucks added to the Columbia depot.',
    hoursAgo: 49,
    status: 'In Review',
    team: 'Auto Team',
    needsReview: true,
    reviewReasons: ['Missing Required Data'],
    confidence: 0.84,
    document: pdf('riverbend-partial-dec.pdf', 190_442),
    extraction: {
      carrier: 'Ridgeline Indemnity',
      policyNumber: '',
      namedInsured: 'Riverbend Logistics',
      effectiveDate: '2026-05-01',
      expirationDate: '2027-05-01',
      policyType: 'Commercial Auto',
      coverageAmount: 750_000,
      validationStatus: 'Failed',
      missingFields: ['policyNumber'],
      fieldConfidence: {
        namedInsured: 0.91,
        carrier: 0.85,
        effectiveDate: 0.82,
        expirationDate: 0.8,
        coverageAmount: 0.83,
      },
    },
  },
  {
    id: 'SUB-10015',
    clientId: 'CLI-1003',
    type: 'Quote',
    lob: 'General Liability',
    description:
      'General liability renewal review ahead of the February expiration. No claims in the current term.',
    hoursAgo: 54,
    status: 'Routed',
    team: 'Casualty Team',
    confidence: 0.91,
    document: pdf('belmont-gl-dec.pdf', 233_910),
    extraction: {
      carrier: 'Granite State Casualty',
      policyNumber: 'GL-77401',
      namedInsured: 'Belmont Fabrication Co',
      effectiveDate: '2026-02-15',
      expirationDate: '2027-02-15',
      policyType: 'General Liability',
      coverageAmount: 2_000_000,
      validationStatus: 'Validated',
      fieldConfidence: {
        namedInsured: 0.95,
        policyNumber: 0.92,
        carrier: 0.9,
        effectiveDate: 0.89,
        expirationDate: 0.88,
        coverageAmount: 0.91,
      },
    },
  },
  {
    id: 'SUB-10014',
    clientId: 'CLI-1005',
    type: 'Claim',
    lob: 'General Liability',
    description:
      'Guest slip and fall at the Westport location on 30 July. Incident report and photographs available.',
    hoursAgo: 72,
    status: 'Closed',
    team: 'Casualty Team',
    confidence: 0.9,
  },
  {
    id: 'SUB-10013',
    clientId: 'CLI-1007',
    type: 'Quote',
    lob: 'Workers Compensation',
    description:
      'Payroll has grown by roughly 30% since the last term. Requesting an updated workers compensation quote.',
    hoursAgo: 78,
    status: 'Routed',
    team: 'WC Team',
    confidence: 0.87,
    document: pdf('vance-payroll-summary.pdf', 301_557),
    extraction: {
      carrier: 'Ridgeline Indemnity',
      policyNumber: 'WC-61228',
      namedInsured: 'Vance Machine Works',
      effectiveDate: '2026-04-01',
      expirationDate: '2027-04-01',
      policyType: 'Workers Compensation',
      coverageAmount: 1_000_000,
      validationStatus: 'Validated',
      fieldConfidence: {
        namedInsured: 0.92,
        policyNumber: 0.86,
        carrier: 0.85,
        effectiveDate: 0.87,
        expirationDate: 0.86,
        coverageAmount: 0.88,
      },
    },
  },
  {
    id: 'SUB-10012',
    clientId: 'CLI-1002',
    type: 'Quote',
    lob: 'Property',
    description:
      'Adding the newly acquired Grandview building to the schedule. Purchase closed 15 July.',
    hoursAgo: 96,
    status: 'Routed',
    team: 'Property Team',
    confidence: 0.92,
  },
  {
    id: 'SUB-10011',
    clientId: 'CLI-1004',
    type: 'Claim',
    lob: 'Commercial Auto',
    description:
      'Minor collision involving unit 214 in a customer lot on 28 July. No injuries reported.',
    hoursAgo: 101,
    status: 'Exception',
    team: 'Unassigned',
    needsReview: true,
    reviewReasons: ['Extraction Failure'],
    confidence: null,
    document: pdf('riverbend-photo-report.pdf', 8_004_119),
    failure: {
      step: 'Extract Document',
      message: 'Document Intelligence request timed out after 30000 ms.',
      retries: 1,
    },
  },
  {
    id: 'SUB-10010',
    clientId: 'CLI-1006',
    type: 'Quote',
    lob: 'Workers Compensation',
    description:
      'Broker submission for a 45-employee client in light manufacturing. Loss runs attached.',
    hoursAgo: 122,
    status: 'Closed',
    team: 'WC Team',
    confidence: 0.89,
  },
  {
    id: 'SUB-10009',
    clientId: 'CLI-1001',
    type: 'Claim',
    lob: 'Commercial Auto',
    description:
      'Cargo shift caused trailer damage on I-70 on 24 July. Driver uninjured, load secured.',
    hoursAgo: 146,
    status: 'Closed',
    team: 'Auto Team',
    confidence: 0.93,
  },
  {
    id: 'SUB-10008',
    clientId: 'CLI-1008',
    type: 'Quote',
    lob: 'General Liability',
    description:
      'General liability for the storage operation, including customer access hours and on-site security arrangement.',
    hoursAgo: 170,
    status: 'Routed',
    team: 'Casualty Team',
    confidence: null,
  },
  {
    id: 'SUB-10007',
    clientId: 'CLI-1003',
    type: 'Quote',
    lob: 'Property',
    description:
      'Requesting property quote for the second shop building brought online in June.',
    hoursAgo: 194,
    status: 'Closed',
    team: 'Property Team',
    confidence: 0.9,
  },
  {
    id: 'SUB-10006',
    clientId: 'CLI-1005',
    type: 'Quote',
    lob: 'Workers Compensation',
    description:
      'Seasonal staff increase for the summer term. Requesting a workers compensation review.',
    hoursAgo: 220,
    status: 'Routed',
    team: 'WC Team',
    confidence: 0.86,
  },
  {
    id: 'SUB-10005',
    clientId: 'CLI-1002',
    type: 'Claim',
    lob: 'General Liability',
    description:
      'Tenant reported a trip hazard incident in the Elmwood lobby on 12 July.',
    hoursAgo: 244,
    status: 'Closed',
    team: 'Casualty Team',
    confidence: null,
  },
  {
    id: 'SUB-10004',
    clientId: 'CLI-1007',
    type: 'Quote',
    lob: 'Commercial Auto',
    description:
      'Service van added to the fleet. Requesting commercial auto quote for the additional unit.',
    hoursAgo: 268,
    status: 'Closed',
    team: 'Auto Team',
    confidence: 0.94,
  },
  {
    id: 'SUB-10003',
    clientId: 'CLI-1004',
    type: 'Quote',
    lob: 'Property',
    description:
      'Warehouse contents value has increased. Requesting a revised property schedule.',
    hoursAgo: 292,
    status: 'Closed',
    team: 'Property Team',
    confidence: 0.91,
  },
  {
    id: 'SUB-10002',
    clientId: 'CLI-1006',
    type: 'Quote',
    lob: 'General Liability',
    description:
      'Broker request for general liability on a professional services client relocating offices.',
    hoursAgo: 316,
    status: 'Closed',
    team: 'Casualty Team',
    confidence: null,
  },
  {
    id: 'SUB-10001',
    clientId: 'CLI-1001',
    type: 'Quote',
    lob: 'Workers Compensation',
    description:
      'Initial workers compensation quote for the driver and yard staff population.',
    hoursAgo: 340,
    status: 'Closed',
    team: 'WC Team',
    confidence: 0.88,
  },
]

// ---------------------------------------------------------------------------
// Expansion
// ---------------------------------------------------------------------------

export interface SeedData {
  clients: Client[]
  submissions: Submission[]
  extractions: ExtractedPolicyData[]
  logs: AutomationLog[]
}

/**
 * Build the seeded dataset relative to `now`.
 *
 * Also advances the id counters past the seeded range so ids generated at
 * runtime cannot collide with seeded ones.
 */
export function createSeedData(now: Date = new Date()): SeedData {
  const base = now.getTime()

  const clients: Client[] = CLIENT_SPECS.map((spec) => ({
    clientId: spec.id,
    clientName: spec.contact,
    companyName: spec.company,
    email: spec.email,
    phone: spec.phone,
    clientType: spec.type,
    createdDate: iso(base, spec.createdDaysAgo * DAY),
    active: spec.active ?? true,
    normalizedEmail: normalizeEmail(spec.email),
  }))

  const submissions: Submission[] = []
  const extractions: ExtractedPolicyData[] = []
  const logs: AutomationLog[] = []

  let extractionSeq = 20_000
  let logSeq = 30_000

  for (const spec of SUBMISSION_SPECS) {
    const received = iso(base, spec.hoursAgo * HOUR)

    submissions.push({
      submissionId: spec.id,
      clientId: spec.clientId,
      submissionType: spec.type,
      lineOfBusiness: spec.lob,
      description: spec.description,
      dateReceived: received,
      status: spec.status,
      assignedTeam: spec.team,
      duplicateFlag: Boolean(spec.duplicateOf),
      duplicateReason: spec.duplicateReason ?? null,
      duplicateOfSubmissionId: spec.duplicateOf ?? null,
      confidenceScore: spec.confidence ?? null,
      needsHumanReview: spec.needsReview ?? false,
      reviewReasons: spec.reviewReasons ?? [],
      source: 'Web Intake',
      originalDocument: spec.document
        ? { ...spec.document, uploadedAt: received }
        : null,
    })

    if (spec.extraction) {
      const e = spec.extraction
      const confidences = Object.values(e.fieldConfidence)
      extractions.push({
        extractionId: `EXT-${++extractionSeq}`,
        submissionId: spec.id,
        carrier: e.carrier || null,
        policyNumber: e.policyNumber || null,
        effectiveDate: e.effectiveDate,
        expirationDate: e.expirationDate,
        namedInsured: e.namedInsured || null,
        policyType: e.policyType,
        coverageAmount: e.coverageAmount,
        extractionConfidence:
          spec.confidence ??
          confidences.reduce((sum, c) => sum + c, 0) / (confidences.length || 1),
        fieldConfidence: e.fieldConfidence,
        validationStatus: e.validationStatus,
        missingFields: e.missingFields ?? [],
        provider: 'fixture',
        extractedAt: received,
      })
    }

    // One automation log per seeded submission, reflecting how that run ended.
    const runStatus =
      spec.status === 'Exception'
        ? 'Failed'
        : spec.needsReview
          ? 'Needs Review'
          : 'Succeeded'

    const durationMs = spec.failure ? 31_400 : 780 + (spec.document ? 1_900 : 0)

    logs.push({
      logId: `LOG-${++logSeq}`,
      submissionId: spec.id,
      workflowName: 'Insurance Submission Intake & Triage',
      runId: `run_seed${spec.id.replace('SUB-', '')}`,
      started: received,
      completed: new Date(new Date(received).getTime() + durationMs).toISOString(),
      status: runStatus,
      stepFailed: spec.failure?.step ?? null,
      errorMessage: spec.failure?.message ?? null,
      retryCount: spec.failure?.retries ?? 0,
      durationMs,
      steps: [],
    })
  }

  // Keep runtime ids clear of the seeded range.
  seedCounter('CLI', 1008)
  seedCounter('SUB', 10_024)
  seedCounter('EXT', extractionSeq)
  seedCounter('LOG', logSeq)

  return { clients, submissions, extractions, logs }
}
