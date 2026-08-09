# Acceptance Criteria

**Version:** 1.0 — Phase 1

Written as Given / When / Then. Each criterion is verifiable and maps to at
least one automated test in [`test-plan.md`](test-plan.md).

---

## AC-001 — Valid submission is accepted and routed
*Covers FR-001, FR-013, FR-007*

**Given** a submitter provides name, company, email, phone, submission type,
line of business, and description, all satisfying validation,
**When** the submission is posted,
**Then** the system shall:

- create a `Submission` record with status progressing `New` → `Processing` → `Routed`,
- assign a team according to the line-of-business rule,
- set `needsHumanReview = false`,
- return a submission reference to the submitter,
- write an `AutomationLog` entry with status `Succeeded`.

---

## AC-002 — Existing client is matched, not duplicated
*Covers FR-003, FR-017, FR-019*

**Given** a `Client` exists with email `dispatch@acmetrucking.example`,
**When** a submission arrives with email `  Dispatch@ACMETrucking.Example  `,
**Then** the system shall:

- normalize the address by trimming and lower-casing,
- link the submission to the **existing** client,
- create **no** new client record,
- leave the existing client's fields unmodified.

---

## AC-003 — Unknown client is created
*Covers FR-018*

**Given** no client exists with the submitted email,
**When** a valid submission is posted,
**Then** the system shall create a new `Client`, link the submission to it, and
process the submission normally with `needsHumanReview = false`.

---

## AC-004 — Possible duplicate is flagged for review
*Covers FR-004, FR-020, FR-021, BR-013*

**Given** a `Commercial Auto` **quote** submission exists for a client, received
5 days ago, in a non-`Exception` status,
**When** the same client submits another `Commercial Auto` quote and
`DUPLICATE_WINDOW_DAYS` is 30,
**Then** the system shall set:

```text
duplicateFlag     = true
duplicateReason   = "Same client, same submission type (Quote), same line of
                     business (Commercial Auto), previous submission received
                     5 days ago (window: 30 days)."
needsHumanReview  = true
status            = Duplicate
```

**And** shall not reject, close, or merge the submission.

**And given** the previous submission was received 45 days ago,
**then** `duplicateFlag` shall be `false` and the submission shall route
normally.

---

## AC-005 — Submission without a document completes
*Covers FR-015*

**Given** a valid submission with no attached document,
**When** it is processed,
**Then** the system shall:

- skip extraction entirely,
- create **no** `ExtractedPolicyData` record,
- apply routing rules using the form-supplied line of business,
- reach status `Routed` with `needsHumanReview = false`,
- record in the automation log that extraction was skipped because no document
  was supplied.

A missing document is a normal path, not an exception.

---

## AC-006 — Low-confidence extraction routes to review
*Covers FR-006, FR-024, BR-007, BR-019*

**Given** a document is analyzed successfully and `EXTRACTION_CONFIDENCE_THRESHOLD`
is 0.80,
**When** aggregate extraction confidence is 0.62,
**Then** the system shall:

- **retain** every extracted value,
- set `ExtractedPolicyData.validationStatus = Unverified`,
- set `Submission.confidenceScore = 0.62`,
- set `needsHumanReview = true`,
- set status `In Review`,
- **not** assign the submission as a completed route,
- retain per-field confidences so a reviewer can see which field was weak.

**And given** confidence is exactly 0.80,
**then** the extraction shall be `Validated` and the submission routed — the
threshold is inclusive.

---

## AC-007 — Unsupported or oversize file is rejected at validation
*Covers FR-014, BR-012*

**Given** a submitter attaches a file whose type is outside the accepted set,
or whose size exceeds `MAX_UPLOAD_MB`,
**When** the submission is posted,
**Then** the system shall:

- reject the submission with HTTP 400,
- return a field-level error naming the specific reason (type or size),
- create **no** `Submission`, `Client`, or `ExtractedPolicyData` record.

Rejection happens before any record is created, so an invalid upload leaves no
partial state.

---

## AC-008 — Extraction failure routes to the exception queue
*Covers BR-009, IR-003, IR-004, FR-033*

**Given** the extraction provider returns an error, times out, or returns a
response that fails schema validation,
**When** the submission is processed,
**Then** the system shall:

- catch the failure,
- set status `Exception`,
- write an `AutomationLog` entry with status `Failed`, the failing step, and
  the error message,
- **preserve** the submission and its form data,
- surface it in the Exceptions queue.

The submission is never lost, and the failure is never silent.

---

## AC-009 — Unknown line of business routes to General Intake and flags
*Covers FR-029, BR-006*

**Given** a submission carries a line of business with no routing rule,
**When** business rules are applied,
**Then** the system shall:

- assign `General Intake`,
- set `needsHumanReview = true`,
- set status `In Review`,
- record the reason as an unmatched routing rule.

The submission keeps moving *and* a human is told the rules table has a gap.
Neither a hard failure nor a silent default.

---

## AC-010 — Routing is deterministic
*Covers FR-007, FR-028, FR-030, BR-001–BR-005*

**Given** each of the five known lines of business,
**When** business rules are applied to an otherwise valid submission,
**Then** the assignment shall be exactly:

| Line of business | Assigned team |
|---|---|
| Commercial Auto | Auto Team |
| Property | Property Team |
| General Liability | Casualty Team |
| Workers Compensation | WC Team |
| Other | General Intake |

**And** repeated evaluation of identical input shall produce an identical
assignment.

**And** an AI-extracted `policyType` that disagrees with the submitted line of
business shall **not** change the assignment; the disagreement shall be
recorded for review instead.

---

## AC-011 — Submitter is acknowledged on successful routing
*Covers FR-008, FR-031*

**Given** a submission reaches status `Routed`,
**When** the workflow completes,
**Then** the system shall emit a confirmation event addressed to the submitter,
containing the submission reference and the assigned team, and shall record
that event on the workflow run — whether or not a mail transport is configured.

**And given** a submission ends in `Exception`,
**then** no routing confirmation shall be sent to the submitter.

---

## AC-012 — Every run is logged
*Covers FR-009, FR-012, FR-032, FR-034, NFR-007*

**Given** any submission is processed,
**When** the workflow finishes by any path — success, review, duplicate, or
exception,
**Then** the system shall write at least one `AutomationLog` entry containing:

- `submissionId`, `workflowName`, and `runId`,
- `started` and `completed` timestamps,
- a terminal `status` of `Succeeded`, `Failed`, or `NeedsReview`,
- for failures, the `stepFailed` and `errorMessage`.

**And** no submission shall remain in `Processing` after the workflow returns.

---

## AC-013 — Missing required extracted field routes to Intake Correction
*Covers BR-010*

**Given** extraction succeeds with acceptable confidence,
**When** a required field (named insured, policy number, or carrier) is absent
from the normalized result,
**Then** the system shall:

- set `ExtractedPolicyData.validationStatus = Failed`,
- retain whatever values were extracted,
- set `needsHumanReview = true`,
- set status `In Review` with the reason *Intake Correction*,
- name the missing field(s) in the review reason.

---

## AC-014 — Record write failure is caught and logged
*Covers BR-011, NFR-005*

**Given** the repository raises an error while persisting a record,
**When** the workflow attempts the write,
**Then** the system shall set status `Exception`, log the failure with the
failing step, and return a controlled error to the caller. No unhandled
exception shall escape the orchestrator, and no submission shall be left in
`Processing`.

---

## AC-015 — Concurrent exception conditions resolve by precedence
*Covers BR-020*

**Given** a submission is both a possible duplicate and below the confidence
threshold,
**When** business rules are applied,
**Then** the system shall set status `Duplicate` (higher precedence),
`needsHumanReview = true`, and shall record **both** reasons — the duplicate
reason and the low-confidence reason.

Precedence order: `Exception` > `Duplicate` > `In Review` > `Routed`.

---

## AC-016 — No secret is exposed
*Covers NFR-001, NFR-002, NFR-003, FR-027*

**Given** the repository at any commit,
**Then**:

- no `.env` or `.env.local` file is tracked,
- `.env.example` contains no populated secret values,
- no `NEXT_PUBLIC_` variable carries a credential,
- extraction requests originate server-side only; the browser posts the
  document to this application's own API route and never to Azure.

This criterion is enforced by an automated test, not by review.

---

## AC-017 — Operations dashboard reflects live state
*Covers FR-010, FR-035, FR-036, FR-037*

**Given** submissions exist in a mix of statuses,
**When** an operations user opens the dashboard,
**Then** the system shall display:

- counters for submissions today, needs review, exceptions, and routed today,
- a queue showing submission reference, type, line of business, client, status,
  assigned team, and date received,
- filterable views for New, Needs Review, Duplicates, Exceptions, each line of
  business, and Closed,
- automation health: succeeded, needs review, failed, and the most frequent
  error messages.

**And** every count shall agree with the underlying records.

---

## Definition of done for Phase 1

- [x] Business case documented with a labeled, sensitivity-tested opportunity model
- [x] Current state mapped with step-level timing, pain points, and data-quality analysis
- [x] Future state mapped with automation disposition per step and explicit decision points
- [x] Functional, business-rule, data, integration, and non-functional requirements written
- [x] Acceptance criteria written in Given/When/Then form
- [x] Traceability established: pain point → requirement → criterion → test case

---

**Next:** [`test-plan.md`](test-plan.md)
