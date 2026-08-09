# Power Automate — Flow Design

**Version:** 1.0 — Phase 5
**Flow name:** `Insurance Submission Intake & Triage`
**Type:** Automated cloud flow
**Reference implementation:** [`lib/workflow/orchestrator.ts`](../lib/workflow/orchestrator.ts)

---

## 1. Purpose of this document

The TypeScript orchestrator in this repository and the Power Automate flow
described here are two implementations of one design. This document maps them
action-by-action so the local logic is traceable to real Power Automate steps
rather than being a loose analogy.

Where the two differ, the difference is called out with the reason.

## 2. Structure

The flow is organized as four scopes, which is Power Automate's idiom for
TRY / CATCH / FINALLY:

```text
┌─ Scope: TRY ────────────────────────────────────────────────┐
│  1. Validate submission                                      │
│  2. Resolve client (find or create)                          │
│  3. Create submission record (status Processing)             │
│  4. Duplicate check                                          │
│  5. Extract document          (condition: document attached) │
│  6. Validate extraction                                      │
│  7. Apply business rules                                     │
│  8. Update submission with the outcome                       │
│  9. Send confirmation         (condition: status = Routed)   │
└──────────────────────────────────────────────────────────────┘
        │ configure run after: has failed, is skipped, has timed out
        ▼
┌─ Scope: CATCH ──────────────────────────────────────────────┐
│  10. Capture the failing action and message                  │
│  11. Set submission status = Exception                       │
│  12. Notify operations                                       │
└──────────────────────────────────────────────────────────────┘
        │ configure run after: is successful, has failed, is skipped
        ▼
┌─ Scope: FINALLY ────────────────────────────────────────────┐
│  13. Create Automation Log row                               │
│  14. Set completion time and duration                        │
└──────────────────────────────────────────────────────────────┘
```

The `configure run after` settings on CATCH and FINALLY are the whole
mechanism. CATCH runs when TRY fails, is skipped, or times out. FINALLY runs
after CATCH regardless of how CATCH itself ended — which is what guarantees an
automation log row exists for every run (FR-032).

## 3. Trigger

**When a row is added (Dataverse)** — table `iit_submission`, scope
*Organization*.

| Setting | Value |
|---|---|
| Table | `iit_submission` |
| Scope | Organization |
| Filter | `iit_status eq 100000000` (New) |
| Run-only-when | — |

Row-added rather than an HTTP request trigger. The intake surface — Power Apps,
Microsoft Forms, or the web form — creates the row; the flow reacts. Two
reasons: the submission is durable before any processing starts, so a flow
failure cannot lose it; and intake surfaces can be added later without changing
the flow.

**Reference implementation difference.** The Next.js API route calls the
orchestrator directly rather than writing a row and waiting for a trigger. A
web request needs a synchronous answer for the submitter, and polling for a
row change to build that response would be worse in every way. The
orchestrator still writes the record before doing any slow work, preserving
the durability property the trigger design gives.

## 4. Actions

### 1 — Validate submission

| | |
|---|---|
| Action | `Condition` — Validate required fields |
| Checks | `iit_clientname`, `iit_companyname`, `iit_email`, `iit_phone`, `iit_submissiontype`, `iit_lineofbusiness`, `iit_description` all non-empty |
| False branch | Set status `In Review`, review reason *Missing Required Data*, terminate as `Succeeded` |
| Code | `intakeFormSchema.safeParse()` in `app/api/submissions/route.ts` |

Compose action `Normalized Email`:

```text
toLower(trim(triggerOutputs()?['body/iit_email']))
```

### 2 — Resolve client

| | |
|---|---|
| Action | `List rows` on `iit_client` |
| Filter | `iit_normalizedemail eq '@{outputs('Normalized_Email')}'` |
| Top count | 1 |
| Code | `repository.findClientByNormalizedEmail()` |

Then a condition on `length(outputs('List_clients')?['body/value'])`:

- **> 0** → `Set variable` `ClientId` to the first row's id. No write.
- **= 0** → `Add a row` to `iit_client` with `iit_normalizedemail` set from the
  Compose above, then set `ClientId` from the created row.

The alternate key on `iit_normalizedemail` makes a concurrent duplicate
creation a platform-level constraint violation rather than a race the flow has
to defend against — which is the reason the key exists.

### 3 — Create submission record

The trigger row already exists. `Update a row` sets `iit_status` to
`Processing` (100000001) and `iit_clientid` to the resolved client.

| Code | `repository.createSubmission()` with status `Processing` |
|---|---|

### 4 — Duplicate check

| | |
|---|---|
| Action | `List rows` on `iit_submission` |
| Filter | see [`expressions.md`](expressions.md) §2 |
| Order by | `iit_datereceived desc` |
| Code | `checkForDuplicate()` in `lib/workflow/duplicate-detection.ts` |

The OData filter encodes all four conditions of BR-013 — client, type, line of
business, and the date window — plus the BR-015 exclusion of `Exception`
submissions. Filtering server-side rather than retrieving and filtering in the
flow matters: the composite index on `iit_submission` exists to satisfy exactly
this predicate.

### 5 — Extract document

`Condition`: does the submission have a document?

```text
not(empty(triggerOutputs()?['body/iit_documentname']))
```

**False branch** — Compose `Extraction Skipped` with
`"No document supplied — extraction skipped."`. Recorded, not omitted: a skip
is an outcome (AC-005).

**True branch**:

| Step | Action |
|---|---|
| 5a | `Download a file or an image` (Dataverse) — column `iit_originaldocument` |
| 5b | `HTTP` — POST to the Document Intelligence analyze endpoint |
| 5c | `Do until` — poll `Operation-Location` until `status` is `succeeded` or `failed` |
| 5d | `Parse JSON` against [`../ai/output-schema.json`](../ai/output-schema.json) |

The HTTP action's authentication header reads from an environment variable
holding a Key Vault reference — never a literal key in the flow definition
(NFR-001).

```json
{
  "method": "POST",
  "uri": "@{parameters('DocIntelEndpoint')}/documentintelligence/documentModels/@{parameters('DocIntelModelId')}:analyze?api-version=2024-11-30",
  "headers": {
    "Ocp-Apim-Subscription-Key": "@{parameters('DocIntelKey')}",
    "Content-Type": "@{body('Download_file')?['contentType']}"
  },
  "body": "@body('Download_file')"
}
```

`Do until` is configured with a count limit **and** a timeout (`PT2M`).
Count alone would let a fast-failing poll loop spin; timeout alone would let a
slow one run to the flow's own limit.

Retry policy on the HTTP action: exponential, 3 retries, `PT10S` interval —
matching the adapter's behaviour for 5xx and 429.

### 6 — Validate extraction

| Step | Expression | Code |
|---|---|---|
| Aggregate confidence | see [`expressions.md`](expressions.md) §3 | `data.extractionConfidence` |
| Missing required fields | see §4 | `findMissingRequiredFields()` |
| Below threshold? | `less(variables('Confidence'), float(parameters('ConfidenceThreshold')))` | `isBelowConfidenceThreshold()` |
| Validation status | see §5 | `validationStatus` |

`Add a row` to `iit_extractedpolicydata` regardless of the outcome. Values are
retained even when unverified or incomplete (FR-024) — a reviewer with four of
six fields is better off than one starting from the document.

### 7 — Apply business rules

`Switch` on `iit_lineofbusiness`:

| Case | Set `AssignedTeam` |
|---|---|
| Commercial Auto (100000000) | Auto Team |
| Property (100000001) | Property Team |
| General Liability (100000002) | Casualty Team |
| Workers Compensation (100000003) | WC Team |
| Other (100000004) | General Intake |
| **Default** | General Intake **and** set `UnknownRouting` true |

A `Switch` rather than nested conditions: it reads as the routing table it is,
and adding a line of business is one case rather than a re-nested condition
tree.

The default case is the BR-006 path — General Intake *and* a review flag, so
the submission keeps moving while a human is told the rules table has a gap.

Outcome resolution follows the precedence in
[`expressions.md`](expressions.md) §6: Exception > Duplicate > In Review >
Routed, with every applicable reason collected into the multi-select
`iit_reviewreasons`.

### 8 — Update submission

`Update a row` on `iit_submission` writing status, assigned team, duplicate
flag and reason, duplicate-of lookup, confidence score, needs-review flag, and
review reasons.

### 9 — Send confirmation

`Condition`: `equals(variables('Status'), 'Routed')`.

**True** — `Send an email (V2)` to the client's address, with the submission
number and assigned team. **False** — Compose recording why no confirmation
was sent.

Only on successful routing (AC-011). Telling a submitter their request was
routed to the Auto Team when the workflow failed would be worse than silence.

### 10–12 — CATCH scope

`Configure run after` on the CATCH scope: **has failed**, **is skipped**,
**has timed out**.

| Step | Action |
|---|---|
| 10 | `Filter array` over `result('TRY')` where `status` equals `Failed` — identifies the failing action and its error |
| 11 | `Update a row` — status `Exception`, assigned team `Unassigned`, needs review true |
| 12 | `Post a message` (Teams) to the operations channel |

`result('TRY')` is the mechanism that makes `stepFailed` accurate rather than
generic. It returns the outcome of every action inside the scope, so the log
records *which* action failed. See [`error-handling.md`](error-handling.md).

### 13–14 — FINALLY scope

`Configure run after`: **is successful**, **has failed**, **is skipped**,
**has timed out** — every terminal state, so this scope always runs.

`Add a row` to `iit_automationlog` with the run id
(`workflow()['run']['name']`), start and completion times, duration, run
status, failing action, error message, retry count, and the JSON step trace.

## 5. Action-to-code map

| # | Power Automate action | Reference implementation |
|---|---|---|
| Trigger | When a row is added | `POST /api/submissions` |
| 1 | Condition — validate | `intakeFormSchema.safeParse()` |
| — | Compose — normalized email | `normalizeEmail()` |
| 2 | List rows / Add a row (client) | `findClientByNormalizedEmail()` / `createClient()` |
| 3 | Update a row → Processing | `createSubmission()` |
| 4 | List rows (duplicate candidates) | `findDuplicateCandidates()` + `checkForDuplicate()` |
| 5 | HTTP + Do until + Parse JSON | `AzureDocumentIntelligenceAdapter.extract()` |
| 6 | Conditions + Add a row | `findMissingRequiredFields()`, `isBelowConfidenceThreshold()`, `createExtraction()` |
| 7 | Switch | `resolveTeam()` + `resolveOutcome()` |
| 8 | Update a row | `updateSubmission()` |
| 9 | Condition + Send an email | `shouldSendConfirmation()` + `buildConfirmation()` |
| 10–12 | CATCH scope | `catch` block |
| 13–14 | FINALLY scope | `finally` block + `RunLogger.finish()` |

## 6. Environment variables

| Name | Type | Purpose |
|---|---|---|
| `iit_DocIntelEndpoint` | Text | Document Intelligence endpoint |
| `iit_DocIntelKey` | Secret (Key Vault) | API key — **never** a literal value |
| `iit_DocIntelModelId` | Text | Model id, default `prebuilt-document` |
| `iit_ConfidenceThreshold` | Decimal | Default `0.80` |
| `iit_DuplicateWindowDays` | Number | Default `30` |
| `iit_OperationsChannel` | Text | Teams channel for exception notifications |

The two thresholds are environment variables specifically so an operations lead
can tune them per environment without editing the flow (BR-014, BR-017).

## 7. Known differences from the reference implementation

| Aspect | Power Automate | Reference | Why |
|---|---|---|---|
| Trigger | Row-added | Direct call from the API route | A web request needs a synchronous response for the submitter |
| Concurrency | Trigger concurrency 1 by default | Per-request | Dataverse alternate key protects client creation either way |
| Retry | Action-level retry policy | Adapter loop | Same policy, expressed in the idiom of each platform |
| Step trace | `result('TRY')` | `RunLogger` step array | Same data, different source |
| Notification | Send an email (V2) | Confirmation event object | The reference emits an event so the workflow is verifiable with no mail transport |

---

**Related:** [`expressions.md`](expressions.md) · [`error-handling.md`](error-handling.md) · [`../dataverse/schema.md`](../dataverse/schema.md)
