# Dataverse Schema

**Version:** 1.0 — Phase 2
**Publisher prefix:** `iit` (Insurance Intake & Triage)
**Solution:** `InsuranceIntakeTriage`

Four custom tables. Logical names, data types, and option-set values below are
the specification the Power Platform implementation is built from, and they
match the TypeScript definitions in `lib/domain/` field-for-field (IR-006).

> **Why the field names match exactly.** A documented model that drifts from
> the running code is worse than no documentation, because it is trusted. The
> TypeScript interfaces in `lib/domain/types.ts` use the same names as the
> Dataverse schema names below, so any divergence is visible in a diff.

---

## 1. Table summary

| Display name | Logical name | Primary column | Ownership | Purpose |
|---|---|---|---|---|
| Client | `iit_client` | `iit_clientid_display` | User/Team | The party submitting business |
| Submission | `iit_submission` | `iit_submissionnumber` | User/Team | One quote request or claim |
| Extracted Policy Data | `iit_extractedpolicydata` | `iit_extractionid` | User/Team | Structured output of one document extraction |
| Automation Log | `iit_automationlog` | `iit_logid` | Organization | One workflow run |

---

## 2. Client — `iit_client`

| Display name | Schema name | Type | Required | Notes |
|---|---|---|---|---|
| Client | `iit_clientid` | Uniqueidentifier | System | GUID primary key |
| Client Reference | `iit_clientid_display` | Text (20) | Yes | Primary name column. Autonumber `CLI-{SEQNUM:4}` |
| Client Name | `iit_clientname` | Text (120) | Yes | Contact person |
| Company Name | `iit_companyname` | Text (160) | Yes | — |
| Email | `iit_email` | Text (254), Email format | Yes | Stored as entered |
| Normalized Email | `iit_normalizedemail` | Text (254) | Yes | Trimmed + lower-cased. **Alternate key.** Match key for FR-017 |
| Phone | `iit_phone` | Text (32), Phone format | Yes | — |
| Client Type | `iit_clienttype` | Choice | Yes | See option set below |
| Created Date | `iit_createddate` | DateTime | Yes | Business-meaningful date, distinct from `createdon` |
| Active | `iit_active` | Yes/No | Yes | Default Yes |

**Alternate key:** `iit_ak_normalizedemail` on `iit_normalizedemail`.
This is the mechanism that makes client matching a keyed lookup rather than a
scan, and it makes accidental duplicate creation a platform-level constraint
violation rather than a logic bug.

**Option set — Client Type (`iit_clienttype`)**

| Value | Label |
|---|---|
| 100000000 | Individual |
| 100000001 | Commercial |
| 100000002 | Broker |

---

## 3. Submission — `iit_submission`

| Display name | Schema name | Type | Required | Notes |
|---|---|---|---|---|
| Submission | `iit_submissionid` | Uniqueidentifier | System | GUID primary key |
| Submission Number | `iit_submissionnumber` | Autonumber | Yes | Primary name column. `SUB-{SEQNUM:5}`. Shown to the submitter |
| Client | `iit_clientid` | Lookup → `iit_client` | Yes | Many-to-one |
| Submission Type | `iit_submissiontype` | Choice | Yes | Quote / Claim |
| Line of Business | `iit_lineofbusiness` | Choice | Yes | Drives routing |
| Description | `iit_description` | Multiline Text (2000) | Yes | — |
| Date Received | `iit_datereceived` | DateTime | Yes | Business receipt time |
| Status | `iit_status` | Choice | Yes | Default `New` |
| Assigned Team | `iit_assignedteam` | Choice | Yes | Default `Unassigned` |
| Duplicate Flag | `iit_duplicateflag` | Yes/No | Yes | Default No |
| Duplicate Reason | `iit_duplicatereason` | Multiline Text (500) | No | Populated when flagged (FR-020) |
| Duplicate Of | `iit_duplicateof` | Lookup → `iit_submission` | No | Self-referential; the submission this may duplicate |
| Confidence Score | `iit_confidencescore` | Decimal (2 dp, 0–1) | No | Null when no document was supplied |
| Needs Human Review | `iit_needshumanreview` | Yes/No | Yes | Default No |
| Review Reasons | `iit_reviewreasons` | Choices (multi-select) | No | All applicable reasons (BR-020) |
| Source | `iit_source` | Choice | Yes | Default `Web Intake` |
| Original Document | `iit_originaldocument` | File | No | The uploaded document |
| Document Name | `iit_documentname` | Text (255) | No | Denormalized for list views |

**Option set — Submission Type (`iit_submissiontype`)**

| Value | Label |
|---|---|
| 100000000 | Quote |
| 100000001 | Claim |

**Option set — Line of Business (`iit_lineofbusiness`)**

| Value | Label | Routes to |
|---|---|---|
| 100000000 | Commercial Auto | Auto Team |
| 100000001 | Property | Property Team |
| 100000002 | General Liability | Casualty Team |
| 100000003 | Workers Compensation | WC Team |
| 100000004 | Other | General Intake |

**Option set — Status (`iit_status`)**

| Value | Label | Meaning |
|---|---|---|
| 100000000 | New | Accepted; workflow not yet started |
| 100000001 | Processing | Workflow running |
| 100000002 | Routed | Assigned to a team, submitter confirmed |
| 100000003 | In Review | Needs human judgement |
| 100000004 | Duplicate | Possible duplicate of an existing submission |
| 100000005 | Exception | Workflow failed |
| 100000006 | Closed | Resolved |

**Option set — Assigned Team (`iit_assignedteam`)**

| Value | Label |
|---|---|
| 100000000 | Auto Team |
| 100000001 | Property Team |
| 100000002 | Casualty Team |
| 100000003 | WC Team |
| 100000004 | General Intake |
| 100000005 | Unassigned |

**Option set — Source (`iit_source`)**

| Value | Label |
|---|---|
| 100000000 | Web Intake |
| 100000001 | Email |
| 100000002 | Phone |
| 100000003 | Broker Portal |

**Option set — Review Reasons (`iit_reviewreasons`, multi-select)**

| Value | Label |
|---|---|
| 100000000 | Low Confidence |
| 100000001 | Possible Duplicate |
| 100000002 | Missing Required Data |
| 100000003 | Unknown Routing Rule |
| 100000004 | Extraction Failure |
| 100000005 | Policy Type Mismatch |

Multi-select is deliberate. A submission can be a possible duplicate *and*
low-confidence; storing one reason would discard information the reviewer
needs (BR-020).

---

## 4. Extracted Policy Data — `iit_extractedpolicydata`

| Display name | Schema name | Type | Required | Notes |
|---|---|---|---|---|
| Extraction | `iit_extractedpolicydataid` | Uniqueidentifier | System | GUID primary key |
| Extraction Reference | `iit_extractionid` | Autonumber | Yes | Primary name column. `EXT-{SEQNUM:5}` |
| Submission | `iit_submissionid` | Lookup → `iit_submission` | Yes | One-to-one, enforced by an alternate key |
| Carrier | `iit_carrier` | Text (160) | No | Null when not found |
| Policy Number | `iit_policynumber` | Text (64) | No | Null when not found |
| Effective Date | `iit_effectivedate` | Date Only | No | — |
| Expiration Date | `iit_expirationdate` | Date Only | No | — |
| Named Insured | `iit_namedinsured` | Text (200) | No | — |
| Policy Type | `iit_policytype` | Choice | Yes | Default `Unknown` |
| Coverage Amount | `iit_coverageamount` | Currency | No | — |
| Extraction Confidence | `iit_extractionconfidence` | Decimal (3 dp, 0–1) | Yes | Aggregate |
| Field Confidence | `iit_fieldconfidence` | Multiline Text (4000) | Yes | JSON map of field → confidence (BR-018) |
| Validation Status | `iit_validationstatus` | Choice | Yes | — |
| Missing Fields | `iit_missingfields` | Text (500) | No | Semicolon-separated (BR-010) |
| Provider | `iit_provider` | Choice | Yes | `azure` / `fixture` — provenance (DR-009) |
| Extracted At | `iit_extractedat` | DateTime | Yes | — |

**Alternate key:** `iit_ak_extraction_submission` on `iit_submissionid`,
enforcing the 1:1 relationship at the platform level (DR-003).

**Option set — Policy Type (`iit_policytype`)**

| Value | Label |
|---|---|
| 100000000 | Commercial Auto |
| 100000001 | Commercial Property |
| 100000002 | General Liability |
| 100000003 | Workers Compensation |
| 100000004 | Umbrella |
| 100000005 | Unknown |

**Option set — Validation Status (`iit_validationstatus`)**

| Value | Label | Meaning |
|---|---|---|
| 100000000 | Validated | Schema passed, required fields present, confidence ≥ threshold |
| 100000001 | Unverified | Usable values, confidence below threshold — needs a human |
| 100000002 | Failed | Schema invalid or a required field missing |
| 100000003 | Not Applicable | No document supplied |

**Option set — Provider (`iit_provider`)**

| Value | Label |
|---|---|
| 100000000 | azure |
| 100000001 | fixture |

**Field Confidence is stored as JSON, not as columns.** The set of extracted
fields varies by document type, and a column per field would require a schema
change every time a new field is extracted. The trade-off — the JSON is not
directly queryable — is acceptable because per-field confidence is read when a
reviewer opens one record, never aggregated across records. The *aggregate*
confidence, which is queried and filtered on, is a first-class decimal column.

---

## 5. Automation Log — `iit_automationlog`

| Display name | Schema name | Type | Required | Notes |
|---|---|---|---|---|
| Log | `iit_automationlogid` | Uniqueidentifier | System | GUID primary key |
| Log Reference | `iit_logid` | Autonumber | Yes | Primary name column. `LOG-{SEQNUM:5}` |
| Submission | `iit_submissionid` | Lookup → `iit_submission` | Yes | Many-to-one (DR-004) |
| Workflow Name | `iit_workflowname` | Text (160) | Yes | — |
| Run ID | `iit_runid` | Text (64) | Yes | Power Automate run correlation id |
| Started | `iit_started` | DateTime | Yes | — |
| Completed | `iit_completed` | DateTime | No | Null while the run is open |
| Duration (ms) | `iit_durationms` | Whole Number | No | — |
| Status | `iit_runstatus` | Choice | Yes | — |
| Step Failed | `iit_stepfailed` | Choice | No | Null on success (FR-009) |
| Error Message | `iit_errormessage` | Multiline Text (4000) | No | — |
| Retry Count | `iit_retrycount` | Whole Number | Yes | Default 0 |
| Step Trace | `iit_steptrace` | Multiline Text (8000) | No | JSON array of step outcomes (NFR-007) |

**Option set — Run Status (`iit_runstatus`)**

| Value | Label |
|---|---|
| 100000000 | Succeeded |
| 100000001 | Needs Review |
| 100000002 | Failed |

**Option set — Step Failed (`iit_stepfailed`)**

| Value | Label |
|---|---|
| 100000000 | Validate Submission |
| 100000001 | Resolve Client |
| 100000002 | Duplicate Check |
| 100000003 | Extract Document |
| 100000004 | Validate Extraction |
| 100000005 | Apply Business Rules |
| 100000006 | Persist Records |
| 100000007 | Send Confirmation |
| 100000008 | Write Audit Log |

`Step Failed` is a choice rather than free text specifically so failures can be
grouped. "Top errors" on the operations dashboard is a `count by stepFailed`,
which a text column would make unreliable.

---

## 6. Design decisions

**Why `normalizedEmail` is stored rather than computed.**
Dataverse alternate keys require a physical column, and matching should be a
key lookup rather than a scan. Storing it also makes the match key
*inspectable* — when someone disputes a client match, the value that was
matched on can be read directly rather than inferred.

**Why `Duplicate Of` is a self-referential lookup.**
A duplicate reason in prose tells a reviewer *that* something matched. A lookup
lets them open the other submission in one click. Both are stored: the lookup
for navigation, the prose for the audit trail, which must remain readable even
if the referenced record is later deleted.

**Why `Confidence Score` is nullable.**
Null means "no document was supplied, so confidence is not a meaningful
concept". Zero would mean "extraction ran and returned nothing trustworthy".
Collapsing those two into `0` would make it impossible to distinguish a normal
no-document submission from a failed extraction in a report.

**Why Automation Log is organization-owned.**
Logs are operational telemetry, not user-owned business records. Organization
ownership avoids per-record ownership overhead and makes the "automation
health" aggregate straightforward to query.

**Why `Review Reasons` is multi-select.**
See BR-020 above. Status alone is lossy.

---

## 7. Security roles

| Role | Client | Submission | Extracted Policy Data | Automation Log |
|---|---|---|---|---|
| Intake Coordinator | Read, Write, Create | Read, Write, Create | Read, Write | Read |
| Underwriting Team Member | Read | Read, Write (own team) | Read | Read |
| Operations Lead | Read, Write | Read, Write, Delete | Read, Write | Read |
| Integration Service Account | Read, Write, Create | Read, Write, Create | Read, Write, Create | Create, Write |
| Read-Only Auditor | Read | Read | Read | Read |

The integration account can create and update but cannot delete. An automated
process should never be able to remove a business record — a bug in a flow
would otherwise be destructive rather than merely wrong.

---

**Next:** [`relationships.md`](relationships.md)
