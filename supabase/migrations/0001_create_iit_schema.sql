-- ===========================================================================
-- Insurance Intake & Triage Automation
-- Isolated schema for the case study. Touches nothing in `public`.
--
-- Mirrors dataverse/schema.md one-for-one: same entities, same columns, same
-- constrained option sets, same keys and delete behaviour. The point of the
-- Repository interface is that the orchestrator does not change when this
-- replaces the in-memory store — so the shape must not change either.
--
-- Apply with the Supabase CLI, or paste into the SQL editor:
--   supabase db push
-- ===========================================================================

create schema if not exists iit;

-- ---------------------------------------------------------------------------
-- Client  (iit_client)
-- ---------------------------------------------------------------------------
create table if not exists iit.clients (
  client_id         text primary key,
  client_name       text not null,
  company_name      text not null,
  email             text not null,
  -- Alternate key. Makes client matching a keyed lookup and an accidental
  -- duplicate a constraint violation rather than a logic bug (FR-017, FR-019).
  normalized_email  text not null unique,
  phone             text not null,
  client_type       text not null check (client_type in ('Individual', 'Commercial', 'Broker')),
  created_date      timestamptz not null,
  active            boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Submission  (iit_submission)
-- ---------------------------------------------------------------------------
create table if not exists iit.submissions (
  submission_id              text primary key,
  -- R-1: Referential, Restrict Delete. Submissions are business records with
  -- downstream consequences; deleting a client must not silently remove them.
  client_id                  text not null references iit.clients(client_id) on delete restrict,
  submission_type            text not null check (submission_type in ('Quote', 'Claim')),
  line_of_business           text not null check (line_of_business in (
                               'Commercial Auto', 'Property', 'General Liability',
                               'Workers Compensation', 'Other')),
  description                text not null,
  date_received              timestamptz not null,
  status                     text not null check (status in (
                               'New', 'Processing', 'Routed', 'In Review',
                               'Duplicate', 'Exception', 'Closed')),
  assigned_team              text not null check (assigned_team in (
                               'Auto Team', 'Property Team', 'Casualty Team',
                               'WC Team', 'General Intake', 'Unassigned')),
  duplicate_flag             boolean not null default false,
  duplicate_reason           text,
  -- R-4: self-referential, Remove Link on Delete. The prose reason survives on
  -- the newer record even if the original is removed.
  duplicate_of_submission_id text references iit.submissions(submission_id) on delete set null,
  -- Nullable on purpose: null means "no document supplied", which is a
  -- different fact from 0 ("extraction ran, nothing trustworthy").
  confidence_score           numeric(4,3) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  needs_human_review         boolean not null default false,
  -- Multi-select. A submission can be both a possible duplicate AND
  -- low-confidence; storing one reason would discard what a reviewer needs.
  review_reasons             text[] not null default '{}',
  source                     text not null check (source in ('Web Intake', 'Email', 'Phone', 'Broker Portal')),
  original_document          jsonb
);

-- ---------------------------------------------------------------------------
-- Extracted Policy Data  (iit_extractedpolicydata)
-- ---------------------------------------------------------------------------
create table if not exists iit.extracted_policy_data (
  extraction_id         text primary key,
  -- R-2: 1:1 enforced by a unique constraint on the child's lookup, exactly as
  -- the Dataverse alternate key does. Enforcement belongs in the schema.
  submission_id         text not null unique references iit.submissions(submission_id) on delete cascade,
  carrier               text,
  policy_number         text,
  effective_date        date,
  expiration_date       date,
  named_insured         text,
  policy_type           text not null check (policy_type in (
                          'Commercial Auto', 'Commercial Property', 'General Liability',
                          'Workers Compensation', 'Umbrella', 'Unknown')),
  coverage_amount       numeric(14,2) check (coverage_amount is null or coverage_amount >= 0),
  extraction_confidence numeric(4,3) not null check (extraction_confidence >= 0 and extraction_confidence <= 1),
  -- Per-field confidence as JSON: the field set varies by document type, and a
  -- column per field would need a schema change every time a new one appears.
  field_confidence      jsonb not null default '{}'::jsonb,
  validation_status     text not null check (validation_status in ('Validated', 'Unverified', 'Failed', 'Not Applicable')),
  missing_fields        text[] not null default '{}',
  provider              text not null check (provider in ('azure', 'fixture')),
  extracted_at          timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Automation Log  (iit_automationlog)
-- ---------------------------------------------------------------------------
create table if not exists iit.automation_logs (
  log_id        text primary key,
  -- R-3: Parental, Cascade Delete. Many runs per submission — an exception can
  -- be retried, a reviewer can release a corrected record.
  submission_id text not null references iit.submissions(submission_id) on delete cascade,
  workflow_name text not null,
  run_id        text not null,
  started       timestamptz not null,
  completed     timestamptz,
  duration_ms   integer,
  status        text not null check (status in ('Succeeded', 'Needs Review', 'Failed')),
  -- Constrained rather than free text, which is the only reason "top errors"
  -- aggregates reliably instead of listing one-offs.
  step_failed   text check (step_failed is null or step_failed in (
                  'Validate Submission', 'Resolve Client', 'Duplicate Check',
                  'Extract Document', 'Validate Extraction', 'Apply Business Rules',
                  'Persist Records', 'Send Confirmation', 'Write Audit Log')),
  error_message text,
  retry_count   integer not null default 0,
  steps         jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Indexes — each one mirrors a query the application actually makes
-- ---------------------------------------------------------------------------

-- Duplicate candidate query (BR-013). Ordered to satisfy the whole predicate.
create index if not exists idx_submissions_duplicate_candidates
  on iit.submissions (client_id, submission_type, line_of_business, date_received desc);

-- Dashboard queue views (FR-035).
create index if not exists idx_submissions_status_received
  on iit.submissions (status, date_received desc);

create index if not exists idx_submissions_received
  on iit.submissions (date_received desc);

create index if not exists idx_logs_submission
  on iit.automation_logs (submission_id, started desc);

-- Automation health and top errors (FR-037).
create index if not exists idx_logs_status_step
  on iit.automation_logs (status, step_failed);

-- ---------------------------------------------------------------------------
-- Access control
--
-- The application connects over a direct Postgres connection, so no PostgREST
-- exposure is needed or wanted. RLS is enabled with no policies and the API
-- roles are revoked outright: even if this schema were ever exposed, the anon
-- key would reach nothing.
-- ---------------------------------------------------------------------------
alter table iit.clients               enable row level security;
alter table iit.submissions           enable row level security;
alter table iit.extracted_policy_data enable row level security;
alter table iit.automation_logs       enable row level security;

revoke all on schema iit from anon, authenticated;
revoke all on all tables in schema iit from anon, authenticated;
revoke all on all sequences in schema iit from anon, authenticated;

alter default privileges in schema iit revoke all on tables from anon, authenticated;
alter default privileges in schema iit revoke all on sequences from anon, authenticated;

comment on schema iit is
  'Insurance Intake & Triage Automation — self-directed portfolio case study. Synthetic data only. Isolated from public; not exposed via PostgREST.';
