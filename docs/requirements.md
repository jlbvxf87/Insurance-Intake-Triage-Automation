# Requirements

**Version:** 1.0 — Phase 1

Identifier conventions: `FR-` functional · `BR-` business rule ·
`DR-` data requirement · `IR-` integration · `NFR-` non-functional.
"Shall" denotes a requirement; "should" denotes a strong preference.

---

## 1. Functional requirements

### Intake

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | The system shall allow a user to submit an insurance quote request or claim through a digital intake form. | Must |
| FR-002 | The system shall allow the submitter to attach one supporting document. | Must |
| FR-013 | The system shall validate all required fields on the client before submission and again on the server before processing. | Must |
| FR-014 | The system shall restrict uploads by file type and maximum size, and shall reject non-conforming files with a specific reason. | Must |
| FR-015 | The system shall accept a submission with no document attached and complete the workflow using form fields alone. | Must |
| FR-016 | The system shall return a submission reference to the submitter on successful acceptance. | Should |

### Client management

| ID | Requirement | Priority |
|---|---|---|
| FR-003 | The system shall search for an existing client before creating a new client record. | Must |
| FR-017 | The system shall match clients on a normalized email address (trimmed, lower-cased). | Must |
| FR-018 | The system shall create a new client record when no match is found, and link the submission to it. | Must |
| FR-019 | The system shall not automatically merge client records. | Must |

### Duplicate detection

| ID | Requirement | Priority |
|---|---|---|
| FR-004 | The system shall identify possible duplicate submissions. | Must |
| FR-020 | The system shall record a human-readable reason for every duplicate flag. | Must |
| FR-021 | The system shall flag possible duplicates for human review and shall not reject or merge them automatically. | Must |

### Document extraction

| ID | Requirement | Priority |
|---|---|---|
| FR-005 | The system shall extract supported insurance fields from an uploaded document. | Must |
| FR-006 | The system shall flag low-confidence extraction results for human review. | Must |
| FR-022 | The system shall normalize extraction output into a defined schema before use. | Must |
| FR-023 | The system shall validate the extraction response against that schema and treat a malformed response as a failure, not as data. | Must |
| FR-024 | The system shall retain low-confidence extracted values and mark them unverified rather than discarding them. | Must |
| FR-025 | The system shall record per-field and aggregate confidence for every extraction. | Must |
| FR-026 | The system shall operate with a deterministic fixture extraction provider when no Azure credentials are configured, and shall indicate in the UI which provider produced a result. | Must |
| FR-027 | The system shall perform all extraction calls server-side. Credentials shall never be exposed to client code. | Must |

### Business rules and routing

| ID | Requirement | Priority |
|---|---|---|
| FR-007 | The system shall route submissions to an internal team according to line of business. | Must |
| FR-028 | Routing shall be deterministic: identical validated inputs shall always produce the same assignment. | Must |
| FR-029 | The system shall route an unrecognized line of business to General Intake and flag it for review. | Must |
| FR-030 | AI-extracted values shall not override a deterministic routing rule. | Must |

### Notification

| ID | Requirement | Priority |
|---|---|---|
| FR-008 | The system shall send an acknowledgement to the submitter when a submission is successfully routed. | Must |
| FR-031 | The system shall record the acknowledgement as an event on the workflow run, whether or not a mail transport is configured. | Must |

### Logging and audit

| ID | Requirement | Priority |
|---|---|---|
| FR-009 | The system shall record workflow failures, including the step that failed and the error message. | Must |
| FR-012 | The system shall retain workflow run history for every submission. | Must |
| FR-032 | The system shall write an automation log entry for every run, successful or failed. | Must |
| FR-033 | No workflow step shall fail silently. Every failure shall produce a log entry and a non-`Processing` status. | Must |
| FR-034 | The system shall record the start and completion time of every run. | Must |

### Operations

| ID | Requirement | Priority |
|---|---|---|
| FR-010 | Operations users shall be able to view records requiring human review. | Must |
| FR-011 | Authorized users shall be able to correct extracted data. | Should |
| FR-035 | The system shall provide filterable queue views: New, Needs Review, Duplicates, Exceptions, per line of business, and Closed. | Must |
| FR-036 | The system shall display operational counters: submissions today, needs review, exceptions, routed today. | Must |
| FR-037 | The system shall display automation health: successful, needs review, failed, and the most frequent errors. | Must |

## 2. Business rules

### Routing

| ID | Rule |
|---|---|
| BR-001 | Line of business `Commercial Auto` → **Auto Team** |
| BR-002 | Line of business `Property` → **Property Team** |
| BR-003 | Line of business `General Liability` → **Casualty Team** |
| BR-004 | Line of business `Workers Compensation` → **WC Team** |
| BR-005 | Line of business `Other` → **General Intake** |
| BR-006 | Any unrecognized line of business → **General Intake**, `needsHumanReview = true`, status `In Review` |

### Exceptions

| ID | Condition | Outcome |
|---|---|---|
| BR-007 | Aggregate extraction confidence < `EXTRACTION_CONFIDENCE_THRESHOLD` | `needsHumanReview = true`; status `In Review`; extracted values retained and marked unverified |
| BR-008 | Possible duplicate detected | `duplicateFlag = true`; `duplicateReason` populated; `needsHumanReview = true`; status `Duplicate` |
| BR-009 | Extraction failed (service error, timeout, or malformed response) | Status `Exception`; failure logged with the failing step; submission preserved |
| BR-010 | Required extracted field missing after a successful extraction | Status `In Review`, reason *Intake Correction*; values retained |
| BR-011 | Record write failure | Status `Exception`; failure logged; submission not lost |
| BR-012 | Unsupported file type or oversize file | Submission rejected at validation with a field-level reason; no record created |

### Duplicate detection

| ID | Rule |
|---|---|
| BR-013 | A submission is a **possible duplicate** when all of: the normalized client email matches an existing client; the submission type matches; the line of business matches; and the existing submission was received within `DUPLICATE_WINDOW_DAYS`. |
| BR-014 | `DUPLICATE_WINDOW_DAYS` shall be configurable without a code change. Default 30. |
| BR-015 | Submissions in `Exception` status shall not be treated as duplicate candidates — a failed run is not evidence of a prior valid submission. |
| BR-016 | A duplicate flag shall never auto-close, auto-reject, or auto-merge. It escalates to a human. |

### Confidence

| ID | Rule |
|---|---|
| BR-017 | `EXTRACTION_CONFIDENCE_THRESHOLD` shall be configurable without a code change. Default 0.80. |
| BR-018 | Aggregate confidence shall be derived from per-field confidences, and per-field values shall be retained so a reviewer can see which specific field was weak. |
| BR-019 | An extraction that passes the threshold is marked `Validated`. Below the threshold it is marked `Unverified`. A schema or required-field failure is marked `Failed`. |

### Precedence

When more than one exception condition applies to the same submission, the
following order determines the final status. Higher precedence wins; all
applicable reasons are still recorded.

| Precedence | Condition | Status |
|---|---|---|
| 1 | Workflow error (extraction failure, write failure) | `Exception` |
| 2 | Possible duplicate | `Duplicate` |
| 3 | Low confidence, missing required data, or unknown routing | `In Review` |
| 4 | None of the above | `Routed` |

BR-020: A submission that is both a possible duplicate and low-confidence is
statused `Duplicate`, carries `needsHumanReview = true`, and records both
reasons.

## 3. Data requirements

| ID | Requirement |
|---|---|
| DR-001 | The system shall persist four entities: `Client`, `Submission`, `ExtractedPolicyData`, and `AutomationLog`. |
| DR-002 | `Client` to `Submission` shall be one-to-many. |
| DR-003 | `Submission` to `ExtractedPolicyData` shall be one-to-one. |
| DR-004 | `Submission` to `AutomationLog` shall be one-to-many. |
| DR-005 | Line of business, submission type, status, assigned team, validation status, and source shall be constrained enumerations, not free text. |
| DR-006 | Email addresses shall be stored as entered and matched on a normalized form. |
| DR-007 | All demonstration data shall be synthetic. No real client or policy data shall be stored or committed. |
| DR-008 | Uploaded documents shall not be committed to source control. |
| DR-009 | Every `Submission` shall carry the provenance of its extracted data: which provider produced it and with what confidence. |

## 4. Integration requirements

| ID | Requirement |
|---|---|
| IR-001 | Document extraction shall be implemented behind an adapter interface with at least two implementations: Azure AI Document Intelligence and a deterministic fixture provider. |
| IR-002 | Selecting the provider shall be a configuration change only, requiring no code modification. |
| IR-003 | The Azure adapter shall enforce a request timeout and shall convert a timeout into a logged extraction failure. |
| IR-004 | The Azure adapter shall treat the API response as untrusted input and validate it before use. |
| IR-005 | Data persistence shall be implemented behind a repository interface so a Dataverse implementation can replace the in-memory one without changing the orchestrator. |
| IR-006 | The reference implementation and the documented Power Automate implementation shall share field names, enumerations, and status vocabulary. |

## 5. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Security | No credential shall be present in client-side code or in any `NEXT_PUBLIC_` variable. |
| NFR-002 | Security | `.env` and `.env.local` shall be excluded from source control, enforced by an automated test. |
| NFR-003 | Security | Uploaded documents shall not be sent from the browser to any third-party service. |
| NFR-004 | Privacy | Only synthetic data shall be used in the public demonstration. |
| NFR-005 | Reliability | No unhandled exception shall leave a submission in `Processing`. |
| NFR-006 | Reliability | A single failing submission shall not prevent processing of subsequent submissions. |
| NFR-007 | Observability | Every workflow run shall be reconstructable from its automation log entries. |
| NFR-008 | Performance | Workflow execution excluding the extraction call should complete in under 500 ms. |
| NFR-009 | Accessibility | All form controls shall have programmatically associated labels; validation errors shall be announced to assistive technology. |
| NFR-010 | Accessibility | The application shall be operable by keyboard alone, with a visible focus indicator. |
| NFR-011 | Accessibility | Text shall meet WCAG 2.1 AA contrast; colour shall not be the sole carrier of status meaning. |
| NFR-012 | Accessibility | The interface shall respect `prefers-reduced-motion`. |
| NFR-013 | Responsiveness | The interface shall be usable from 360 px to 1920 px with no horizontal scrolling. |
| NFR-014 | Maintainability | Business rules shall be expressed as data or pure functions, testable without I/O. |
| NFR-015 | Maintainability | The production build shall pass with no TypeScript errors. |
| NFR-016 | Testability | Every exception path in section 2 shall have an automated test. |
| NFR-017 | Portability | The application shall build and run from a clean clone with no external service configured. |

## 6. Traceability

| Requirement | Pain point addressed | Acceptance criterion | Test case |
|---|---|---|---|
| FR-001, FR-013 | P-2 | AC-001 | TC-01 |
| FR-003, FR-017 | P-3 | AC-002, AC-003 | TC-02, TC-03 |
| FR-004, BR-013 | P-4 | AC-004 | TC-04 |
| FR-015 | P-9 | AC-005 | TC-05 |
| FR-006, BR-007 | P-2 | AC-006 | TC-06 |
| FR-014, BR-012 | P-9 | AC-007 | TC-07 |
| BR-009, IR-003 | P-9 | AC-008 | TC-08 |
| FR-029, BR-006 | P-5 | AC-009 | TC-09 |
| FR-007, BR-001–005 | P-5 | AC-010 | TC-10 |
| FR-008, FR-031 | P-6 | AC-011 | TC-11 |
| FR-009, FR-032, FR-033 | P-7, P-8 | AC-012 | TC-12 |
| BR-010 | P-2 | AC-013 | TC-13 |
| BR-011 | P-9 | AC-014 | TC-14 |
| BR-020 | P-4 | AC-015 | TC-15 |
| NFR-001, NFR-002 | — | AC-016 | TC-16 |
| FR-035, FR-036, FR-037 | P-7 | AC-017 | TC-17 |

---

**Next:** [`acceptance-criteria.md`](acceptance-criteria.md)
