/**
 * Case-study content.
 *
 * Kept as data, separate from the components that render it, for one reason:
 * every figure on the public page has to be traceable to something in this
 * repository. Holding the copy here makes it possible to read the claims in
 * one place and check them against `docs/` — rather than hunting them across
 * twenty JSX files.
 */

export const SITE = {
  author: 'Jaron Baston',
  title: 'Insurance Intake & Triage Automation',
  tagline:
    'An AI-enabled insurance workflow that turns incoming submissions and policy documents into structured, validated, routed records.',
  metadata: 'Azure AI · Dataverse · Power Automate · REST APIs',
  github: 'https://github.com/jlbvxf87/Insurance-Intake-Triage-Automation',
  /**
   * The resume itself, not a GitHub profile. A reader who clicks "Resume"
   * expecting a document and lands on a repository list has been told the
   * link was mislabelled — on a page whose argument is that claims should be
   * checkable, that is an expensive small error.
   *
   * This copy carries email but no phone number: a link on a public page gets
   * scraped, and an application form is where a phone number belongs.
   */
  resume: '/Jaron-Baston-Resume.pdf',
  linkedin: 'https://www.linkedin.com/in/jaronbaston',
  email: 'mailto:jaronlbaston87@gmail.com',
} as const

// ---------------------------------------------------------------------------
// Hero workflow strip
// ---------------------------------------------------------------------------

export const HERO_NODES = [
  { id: 'intake', icon: 'mail', tone: 'blue', label: 'Intake', caption: 'Submissions received' },
  { id: 'azure', icon: 'brain', tone: 'indigo', label: 'Azure AI', caption: 'Extract & understand' },
  { id: 'dataverse', icon: 'database', tone: 'green', label: 'Dataverse', caption: 'Store & structure' },
  { id: 'duplicate', icon: 'search', tone: 'amber', label: 'Duplicate check', caption: 'Find existing clients' },
  { id: 'routing', icon: 'share', tone: 'violet', label: 'Routing', caption: 'Business rules & triage' },
  { id: 'dashboard', icon: 'chart', tone: 'slate', label: 'Dashboard', caption: 'Track & monitor' },
] as const

// ---------------------------------------------------------------------------
// Problem / System / Outcome
// ---------------------------------------------------------------------------

export const PILLARS = [
  {
    id: 'problem',
    icon: 'alert',
    tone: 'danger',
    title: 'The problem',
    body: 'Insurance intake is a person reading an email. Of roughly twelve minutes of handling per submission, about ten are mechanical — reading a declarations page, searching the CRM, retyping policy fields, recalling which team owns the line of business. Throughput is capped by headcount, and it is where duplicate records and transposed policy numbers originate.',
  },
  {
    id: 'system',
    icon: 'settings',
    tone: 'accent',
    title: 'The system',
    body: 'Digital intake, Azure AI extraction with per-field confidence, normalized client matching, duplicate detection over a configurable window, deterministic routing, and an audit log written for every run. Uncertainty escalates to a named queue instead of being resolved by a guess.',
  },
  {
    id: 'outcome',
    icon: 'check',
    tone: 'ok',
    title: 'The outcome',
    body: 'The mechanical work is automated and the judgement calls are kept — with a queue, a stated reason, and an owner. Every routing decision is reconstructable from its run log, which is the part that makes the automation defensible to operations, compliance, and audit.',
  },
] as const

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

export const HOW_IT_WORKS = [
  {
    step: 1,
    icon: 'file',
    title: 'Digital intake',
    body: 'A structured form replaces free-form email. Validated in the browser and again on the server, against the same schema, so the two cannot drift.',
  },
  {
    step: 2,
    icon: 'sparkles',
    title: 'Document intelligence',
    body: 'Azure AI Document Intelligence reads the attached declarations page or ACORD form and returns candidate values with per-field confidence.',
  },
  {
    step: 3,
    icon: 'database',
    title: 'CRM validation',
    body: 'The client is matched on a normalized email address rather than a free-text name search, so a returning client does not become a second record.',
  },
  {
    step: 4,
    icon: 'scale',
    title: 'Business rules',
    body: 'Routing is a pure function of validated inputs. Identical inputs always produce the same team, which is what makes the decision auditable and testable.',
  },
  {
    step: 5,
    icon: 'zap',
    title: 'Automated routing',
    body: 'The submission is assigned, the submitter is acknowledged, and the run is logged — step by step, including the steps deliberately skipped.',
  },
  {
    step: 6,
    icon: 'user',
    title: 'Human review',
    body: 'Low confidence, possible duplicates, missing data, and unknown routing go to a person. Each queue holds one kind of decision.',
  },
] as const

// ---------------------------------------------------------------------------
// Architecture
// ---------------------------------------------------------------------------

export const ARCHITECTURE_COLUMNS = [
  {
    title: 'Inputs',
    items: [
      { icon: 'mail', label: 'Email', tone: 'blue' },
      { icon: 'globe', label: 'Web form', tone: 'blue' },
      { icon: 'upload', label: 'File upload', tone: 'blue' },
    ],
  },
  {
    title: 'Services',
    items: [
      { icon: 'brain', label: 'Azure AI Document Intelligence', tone: 'indigo' },
      { icon: 'zap', label: 'Power Automate', tone: 'violet' },
      { icon: 'database', label: 'Dataverse', tone: 'green' },
    ],
  },
  {
    title: 'Business logic',
    items: [
      { icon: 'copy', label: 'Duplicate check', tone: 'amber' },
      { icon: 'scale', label: 'Business rules', tone: 'violet' },
      { icon: 'share', label: 'Routing logic', tone: 'slate' },
    ],
  },
  {
    title: 'Outputs',
    items: [
      { icon: 'file', label: 'Dataverse record', tone: 'green' },
      { icon: 'users', label: 'Team queue', tone: 'blue' },
      { icon: 'chart', label: 'Dashboard & alerts', tone: 'slate' },
    ],
  },
] as const

export const ROUTING_RULE_SAMPLE = `{
  "lineOfBusiness": "Commercial Auto",
  "routesTo": "Auto Team",
  "gates": [
    { "rule": "BR-007", "when": "confidence < 0.80",    "then": "In Review" },
    { "rule": "BR-008", "when": "duplicate in 30 days", "then": "Duplicate" },
    { "rule": "BR-010", "when": "required field absent","then": "In Review" },
    { "rule": "BR-006", "when": "no matching rule",     "then": "General Intake + review" }
  ],
  "precedence": ["Exception", "Duplicate", "In Review", "Routed"],
  "deterministic": true
}`

// ---------------------------------------------------------------------------
// Before / after
// ---------------------------------------------------------------------------

export const BEFORE_AFTER = {
  before: {
    label: 'Before — manual intake',
    rows: [
      { value: '~12 min', caption: 'Handling time, every submission' },
      { value: 'High', caption: 'Mechanical effort — read, search, retype, route' },
      { value: 'None', caption: 'Operational visibility. Status lives in a mailbox' },
    ],
  },
  after: {
    label: 'After — automated triage',
    rows: [
      { value: '~2–3 min', caption: 'Handling time, on escalated cases only' },
      { value: 'Judgement only', caption: 'Mechanical steps automated, decisions retained' },
      { value: 'Full audit trail', caption: 'Every run logged, step by step' },
    ],
  },
} as const

// ---------------------------------------------------------------------------
// What I built
// ---------------------------------------------------------------------------

export const WHAT_I_BUILT = [
  { icon: 'database', tone: 'green', title: 'Dataverse data model', body: 'Four tables, option sets, alternate keys, delete behaviour' },
  { icon: 'zap', tone: 'violet', title: 'Power Automate flow', body: 'Four scopes, mapped action-by-action to the reference code' },
  { icon: 'brain', tone: 'indigo', title: 'AI extraction logic', body: 'Adapter interface, normalization, confidence gates' },
  { icon: 'alert', tone: 'danger', title: 'Error handling', body: '18-row failure matrix, every path logged and queued' },
  { icon: 'chart', tone: 'slate', title: 'Dashboard & monitoring', body: 'Queues, KPIs, automation health, top errors' },
  { icon: 'clipboard', tone: 'blue', title: 'Requirements & testing', body: '37 FRs, 20 business rules, 188 automated tests' },
] as const

// ---------------------------------------------------------------------------
// Interactive workflow demo (Phase 9A)
// ---------------------------------------------------------------------------

export interface DemoNode {
  id: string
  label: string
  sublabel: string
  tone: string
  icon: string
  /** Lines revealed in the log panel when this node becomes active. */
  detail: string[]
  status: 'ok' | 'review'
}

export const DEMO_NODES: DemoNode[] = [
  {
    id: 'intake',
    label: 'Submission received',
    sublabel: 'Web intake',
    tone: 'blue',
    icon: 'mail',
    status: 'ok',
    detail: [
      'Dana Whitfield · ACME Trucking LLC',
      'Quote · Commercial Auto',
      'acme-dec-page.pdf · 268 KB',
    ],
  },
  {
    id: 'extract',
    label: 'Azure AI',
    sublabel: 'Reading document',
    tone: 'indigo',
    icon: 'brain',
    status: 'ok',
    detail: [
      'POST documentModels/prebuilt-layout:analyze',
      'Polling operation…',
      'Response validated against schema',
    ],
  },
  {
    id: 'fields',
    label: 'Fields extracted',
    sublabel: 'Confidence 94%',
    tone: 'indigo',
    icon: 'sparkles',
    status: 'ok',
    detail: [
      'Insured: ACME Trucking LLC · 98%',
      'Policy: CA-829103 · 96%',
      'Carrier: Example Insurance · 93%',
    ],
  },
  {
    id: 'client',
    label: 'CRM search',
    sublabel: 'Existing client found',
    tone: 'green',
    icon: 'database',
    status: 'ok',
    detail: [
      'Normalized email → dispatch@acmetrucking.example',
      'Matched CLI-1001 on alternate key',
      'No new client record created',
    ],
  },
  {
    id: 'duplicate',
    label: 'Duplicate check',
    sublabel: 'None found',
    tone: 'amber',
    icon: 'search',
    status: 'ok',
    detail: [
      'Client + type + line of business',
      'Window: 30 days',
      '0 candidates matched',
    ],
  },
  {
    id: 'rules',
    label: 'Business rule',
    sublabel: 'Commercial Auto → Auto Team',
    tone: 'violet',
    icon: 'scale',
    status: 'ok',
    detail: [
      'BR-001 matched',
      'Confidence 0.94 ≥ threshold 0.80',
      'Outcome: Routed',
    ],
  },
  {
    id: 'routed',
    label: 'Submission routed',
    sublabel: 'Auto Team',
    tone: 'green',
    icon: 'share',
    status: 'ok',
    detail: [
      'SUB-10025 assigned',
      'Status New → Processing → Routed',
      'Needs human review: false',
    ],
  },
  {
    id: 'confirm',
    label: 'Customer confirmed',
    sublabel: 'Acknowledgement sent',
    tone: 'blue',
    icon: 'check',
    status: 'ok',
    detail: [
      'Reference SUB-10025 sent to submitter',
      'Automation log written · Succeeded',
      'Run duration 2.7s',
    ],
  },
]

/** The escalating variant — the one that shows the design actually works. */
export const DEMO_NODES_REVIEW: DemoNode[] = [
  { ...DEMO_NODES[0], sublabel: 'Web intake', detail: ['Priya Raman · Belmont Fabrication Co', 'Claim · Workers Compensation', 'belmont-incident-scan.pdf · 1.9 MB'] },
  { ...DEMO_NODES[1] },
  {
    ...DEMO_NODES[2],
    label: 'Fields extracted',
    sublabel: 'Confidence 62%',
    status: 'review',
    detail: [
      'Insured: Belmont Fabrication Co · 71%',
      'Policy: WC-55120-B · 48%  ← weak',
      'Carrier: Granite State Casualty · 66%',
    ],
  },
  { ...DEMO_NODES[3], detail: ['Normalized email → p.raman@belmontfab.example', 'Matched CLI-1003 on alternate key', 'No new client record created'] },
  { ...DEMO_NODES[4] },
  {
    ...DEMO_NODES[5],
    label: 'Confidence gate',
    sublabel: '0.62 < threshold 0.80',
    status: 'review',
    detail: [
      'Values retained, marked Unverified',
      'Routing rule still resolves: WC Team',
      'AI does not decide — the gate does',
    ],
  },
  {
    ...DEMO_NODES[6],
    label: 'Sent to review',
    sublabel: 'Needs human review',
    tone: 'amber',
    status: 'review',
    detail: [
      'Status → In Review',
      'Reason: Low Confidence',
      'Queued for a coordinator',
    ],
  },
  {
    ...DEMO_NODES[7],
    label: 'No confirmation sent',
    sublabel: 'Deliberately silent',
    tone: 'slate',
    status: 'review',
    detail: [
      'A person is about to look at it',
      'Automation log written · Needs Review',
      'Escalation is not failure',
    ],
  },
]

// ---------------------------------------------------------------------------
// Business rules table
// ---------------------------------------------------------------------------

export const ROUTING_TABLE = [
  { lob: 'Commercial Auto', team: 'Auto Team', rule: 'BR-001' },
  { lob: 'Property', team: 'Property Team', rule: 'BR-002' },
  { lob: 'General Liability', team: 'Casualty Team', rule: 'BR-003' },
  { lob: 'Workers Compensation', team: 'WC Team', rule: 'BR-004' },
  { lob: 'Other', team: 'General Intake', rule: 'BR-005' },
  { lob: 'Unrecognized', team: 'General Intake + review', rule: 'BR-006' },
] as const

export const EXCEPTION_TABLE = [
  { condition: 'Extraction failed, timed out, or returned an unparseable response', status: 'Exception', queue: 'Exceptions' },
  { condition: 'Possible duplicate inside the configured window', status: 'Duplicate', queue: 'Duplicates' },
  { condition: 'Confidence below the threshold', status: 'In Review', queue: 'Needs review' },
  { condition: 'A required extracted field is absent', status: 'In Review', queue: 'Needs review' },
  { condition: 'No routing rule matched the line of business', status: 'In Review', queue: 'Needs review' },
  { condition: 'Record write failed', status: 'Exception', queue: 'Exceptions' },
] as const

// ---------------------------------------------------------------------------
// Testing
// ---------------------------------------------------------------------------

export const TEST_SUITES = [
  { file: 'workflow.test.ts', count: 53, covers: 'Orchestrator end to end — every routing, duplicate, confidence, and failure path' },
  { file: 'domain.test.ts', count: 48, covers: 'Validation schemas, upload rules, normalization, configuration, seed integrity' },
  { file: 'extraction.test.ts', count: 44, covers: 'Coercion, label mapping, Azure adapter against an injected fetch' },
  { file: 'review.test.ts', count: 20, covers: 'State machine and every human-review action, including the refusals' },
  { file: 'metrics.test.ts', count: 19, covers: 'Queue views, KPI counters, automation health arithmetic' },
  { file: 'repository-hygiene.test.ts', count: 4, covers: 'No committed secrets, no NEXT_PUBLIC_ credential' },
] as const

export const DEFECTS = [
  {
    id: 'D-1',
    title: '$1,000,000 parsed to null',
    body: 'The "last separator is the decimal point" heuristic turned three grouping commas into 1.000,000 → NaN. Coverage amount silently vanished from every US-formatted document. No throw, no log, a plausible wrong answer.',
  },
  {
    id: 'D-2',
    title: '"Excess Liability" classified as General Liability',
    body: 'The bare liability pattern matched before the umbrella check, mislabelling every excess policy. Reordered, with a comment recording that the order is load-bearing.',
  },
  {
    id: 'D-3',
    title: 'Identifier collision across module instances',
    body: 'Next.js can instantiate the same module across separate bundles. A review action wrote LOG-10001 while the seed had reserved LOG-30xxx. Found by running the app, not by reading it.',
  },
  {
    id: 'D-4',
    title: 'Confirm-duplicate allowed on a non-duplicate',
    body: 'Routed → Closed is a legal transition, so the state machine permitted it — and the log entry would have asserted a false reason for closure. The transition table governs where a record may go, not whether the reason is true.',
  },
] as const

// ---------------------------------------------------------------------------
// Build process
// ---------------------------------------------------------------------------

export const BUILD_PHASES = [
  { phase: '0', title: 'Repository & scaffold', body: 'Structure, environment strategy, and an architecture note written before implementation so the build had something to be measured against.' },
  { phase: '1', title: 'Business analysis', body: 'Current state mapped step by step with timing and pain points; future state with automation disposition per step; requirements, acceptance criteria, and a test plan — all before any code.' },
  { phase: '2', title: 'Data model', body: 'Four entities, option sets as frozen tuples with derived types, Zod schemas shared across both boundaries, synthetic fixtures.' },
  { phase: '3', title: 'Digital intake', body: 'Accessible form, upload validation, and a receipt that reports what actually happened rather than a generic thank-you.' },
  { phase: '4', title: 'Azure AI integration', body: 'REST rather than the SDK so the submit/poll, deadline, and retry policy are visible. Fixture adapter behind the same interface.' },
  { phase: '5', title: 'Workflow logic', body: 'TRY/CATCH/FINALLY orchestrator with repository, extractor, config, and clock injected — which is what makes the failure matrix testable.' },
  { phase: '6', title: 'Error handling & review', body: 'Declared state transitions, five review actions, and an audit trail that keeps recording once a human takes over.' },
  { phase: '7', title: 'Operations dashboard', body: 'Ten queue views, KPI counters, automation health, and per-submission run traces.' },
  { phase: '8', title: 'Testing & documentation', body: '188 tests. Five defects found, two of them silent. Results transcribed from real output, gaps stated rather than hidden.' },
] as const

// ---------------------------------------------------------------------------
// VSL
// ---------------------------------------------------------------------------

export const VSL_TRANSCRIPT = [
  {
    time: '0:00',
    kind: 'Talking head',
    text: 'I wanted to show how I would approach a core business applications problem: reducing manual operational work without removing human judgement.',
  },
  {
    time: '0:08',
    kind: 'System',
    text: 'Instead of an employee manually reading a submission, entering the data, checking for duplicates, and deciding where it goes, I built a workflow that handles the repeatable parts automatically.',
  },
  {
    time: '0:20',
    kind: 'Talking head',
    text: 'The important part was not just adding AI. I designed the data model, business rules, exception paths, and human-review logic around it.',
  },
  {
    time: '0:30',
    kind: 'System',
    text: 'Azure Document Intelligence extracts policy data. Dataverse structures the client and submission records. The workflow checks existing records, flags possible duplicates, applies deterministic routing rules, and sends uncertain cases to human review.',
  },
  {
    time: '0:55',
    kind: 'Build process',
    text: 'I also documented the current and future process, functional requirements, acceptance criteria, and test cases so the system could be maintained and improved.',
  },
  {
    time: '1:08',
    kind: 'Talking head',
    text: 'The result is a working example of how I approach business applications: understand the process, structure the data, automate what is repeatable, and keep people involved where judgement is required.',
  },
] as const
