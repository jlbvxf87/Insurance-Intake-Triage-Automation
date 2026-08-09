# Dataverse Relationships

**Version:** 1.0 — Phase 2

---

## 1. Entity relationship diagram

```text
┌─────────────────────────────────────┐
│ CLIENT                iit_client    │
├─────────────────────────────────────┤
│ PK  iit_clientid           (GUID)   │
│ AK  iit_normalizedemail             │◄──── client matching key (FR-017)
│     iit_clientid_display   CLI-####  │
│     iit_clientname                  │
│     iit_companyname                 │
│     iit_email                       │
│     iit_phone                       │
│     iit_clienttype       (choice)   │
│     iit_createddate                 │
│     iit_active                      │
└──────────────────┬──────────────────┘
                   │
                   │  1 : N        iit_client_submission
                   │  (Referential, Restrict Delete)
                   ▼
┌─────────────────────────────────────┐
│ SUBMISSION        iit_submission    │
├─────────────────────────────────────┤
│ PK  iit_submissionid       (GUID)   │
│ FK  iit_clientid        → Client    │
│ FK  iit_duplicateof     → Submission│──┐  self-referential
│     iit_submissionnumber   SUB-##### │  │  1 : N
│     iit_submissiontype   (choice)   │◄─┘
│     iit_lineofbusiness   (choice)   │
│     iit_description                 │
│     iit_datereceived                │
│     iit_status           (choice)   │
│     iit_assignedteam     (choice)   │
│     iit_duplicateflag               │
│     iit_duplicatereason             │
│     iit_confidencescore             │
│     iit_needshumanreview            │
│     iit_reviewreasons  (multi)      │
│     iit_source           (choice)   │
│     iit_originaldocument  (file)    │
└────────┬───────────────────┬────────┘
         │                   │
         │ 1 : 1             │ 1 : N
         │ (AK enforced)     │ (Parental, Cascade Delete)
         ▼                   ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│ EXTRACTED POLICY DATA│  │ AUTOMATION LOG               │
│ iit_extractedpolicy… │  │ iit_automationlog            │
├──────────────────────┤  ├──────────────────────────────┤
│ PK  …dataid  (GUID)  │  │ PK  iit_automationlogid      │
│ FK  iit_submissionid │  │ FK  iit_submissionid         │
│ AK  iit_submissionid │  │     iit_logid       LOG-##### │
│     iit_extractionid │  │     iit_workflowname         │
│     iit_carrier      │  │     iit_runid                │
│     iit_policynumber │  │     iit_started              │
│     iit_effectivedate│  │     iit_completed            │
│     iit_expirationd… │  │     iit_durationms           │
│     iit_namedinsured │  │     iit_runstatus   (choice) │
│     iit_policytype   │  │     iit_stepfailed  (choice) │
│     iit_coverageamt  │  │     iit_errormessage         │
│     iit_extractionc… │  │     iit_retrycount           │
│     iit_fieldconfid… │  │     iit_steptrace   (JSON)   │
│     iit_validationst…│  └──────────────────────────────┘
│     iit_missingfields│
│     iit_provider     │
└──────────────────────┘
```

---

## 2. Relationship definitions

### R-1 · Client → Submission (1:N)

| Property | Value |
|---|---|
| Schema name | `iit_client_submission` |
| Type | One-to-many |
| Lookup on | `iit_submission.iit_clientid` |
| Required | Yes |
| Behaviour | **Referential, Restrict Delete** |
| Requirement | DR-002 |

**Why Restrict Delete rather than Cascade.** Submissions are business records
with downstream consequences — a routed submission may already be under
review by an underwriting team. Deleting a client must not silently remove
them. Deactivating the client (`iit_active = No`) is the supported path;
attempting a delete while submissions exist fails loudly, which is the correct
outcome.

### R-2 · Submission → Extracted Policy Data (1:1)

| Property | Value |
|---|---|
| Schema name | `iit_submission_extractedpolicydata` |
| Type | One-to-many, constrained to 1:1 by an alternate key |
| Lookup on | `iit_extractedpolicydata.iit_submissionid` |
| Required | Yes |
| Alternate key | `iit_ak_extraction_submission` on `iit_submissionid` |
| Behaviour | **Parental, Cascade Delete** |
| Requirement | DR-003 |

**How 1:1 is actually enforced.** Dataverse has no native one-to-one
relationship type. The relationship is defined as one-to-many, and a unique
alternate key on the child's lookup column makes a second child record a
constraint violation at the platform level rather than a rule the flow has to
remember. Enforcement belongs in the schema, not in the orchestration.

**Why Cascade Delete here.** Extracted data has no meaning without its
submission. It is a *derived* record, not an independent one.

### R-3 · Submission → Automation Log (1:N)

| Property | Value |
|---|---|
| Schema name | `iit_submission_automationlog` |
| Type | One-to-many |
| Lookup on | `iit_automationlog.iit_submissionid` |
| Required | Yes |
| Behaviour | **Parental, Cascade Delete** |
| Requirement | DR-004 |

Many logs per submission because a submission can be reprocessed — an
exception is retried, or a reviewer releases a corrected record. Each attempt
is a separate run with its own `runId`, so the history shows what was tried
and in what order (FR-012).

### R-4 · Submission → Submission (self-referential, 1:N)

| Property | Value |
|---|---|
| Schema name | `iit_submission_duplicateof` |
| Type | One-to-many, self-referential |
| Lookup on | `iit_submission.iit_duplicateof` |
| Required | No |
| Behaviour | **Referential, Remove Link on Delete** |
| Requirement | FR-004, BR-013 |

Points at the earlier submission this one may duplicate. Remove-link rather
than restrict: if the original is deleted, the flag's prose reason survives on
the newer record, so the audit trail does not depend on the other record still
existing.

---

## 3. Cardinality summary

| From | To | Cardinality | Delete behaviour | Requirement |
|---|---|---|---|---|
| Client | Submission | 1 : N | Restrict | DR-002 |
| Submission | Extracted Policy Data | 1 : 1 | Cascade | DR-003 |
| Submission | Automation Log | 1 : N | Cascade | DR-004 |
| Submission | Submission (duplicate of) | 1 : N | Remove link | FR-004 |

---

## 4. Keys and indexes

| Table | Key | Columns | Purpose |
|---|---|---|---|
| Client | Alternate key | `iit_normalizedemail` | Client matching (FR-017); prevents duplicate creation at the platform level |
| Extracted Policy Data | Alternate key | `iit_submissionid` | Enforces 1:1 (DR-003) |
| Submission | Index | `iit_clientid`, `iit_submissiontype`, `iit_lineofbusiness`, `iit_datereceived` | Duplicate candidate query (BR-013) |
| Submission | Index | `iit_status`, `iit_datereceived` | Dashboard queue views (FR-035) |
| Automation Log | Index | `iit_runstatus`, `iit_stepfailed` | Automation health and top errors (FR-037) |

The composite index on Submission mirrors the duplicate rule exactly. The rule
matches on client + type + line of business within a date window, so the index
is ordered to let the platform satisfy the whole predicate.

---

## 5. Reference implementation mapping

| Dataverse | TypeScript | File |
|---|---|---|
| `iit_client` | `Client` | `lib/domain/types.ts` |
| `iit_submission` | `Submission` | `lib/domain/types.ts` |
| `iit_extractedpolicydata` | `ExtractedPolicyData` | `lib/domain/types.ts` |
| `iit_automationlog` | `AutomationLog` | `lib/domain/types.ts` |
| Alternate key on `iit_normalizedemail` | `findClientByNormalizedEmail()` | `lib/data/repository.ts` |
| Composite index for duplicates | `findDuplicateCandidates()` | `lib/data/repository.ts` |
| Choice columns | `as const` tuples + derived unions | `lib/domain/enums.ts` |
| Cascade delete | Not modelled — the demo store never deletes | `lib/data/memory-repository.ts` |

The one deliberate divergence is delete behaviour: the in-memory store has no
delete operation at all, because nothing in the demonstrated workflow deletes a
record. Recording the gap is more useful than implementing an unused path.

---

## 6. Sample data

Synthetic records for all four tables, exported as CSV:

- [`sample-data/clients.csv`](../sample-data/clients.csv) — 8 clients
- [`sample-data/submissions.csv`](../sample-data/submissions.csv) — 24 submissions across every status
- [`sample-data/extracted-policy-data.csv`](../sample-data/extracted-policy-data.csv) — 8 extractions including one `Unverified` and one `Failed`

These are generated from `lib/data/seed.ts` by
`scripts/generate-sample-data.mts`, so the committed CSVs and the running demo
cannot disagree. Regenerate with:

```bash
npx tsx scripts/generate-sample-data.mts
```

---

**Related:** [`schema.md`](schema.md) · [`../docs/requirements.md`](../docs/requirements.md)
