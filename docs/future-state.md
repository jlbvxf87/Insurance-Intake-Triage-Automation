# Future State — Automated Intake & Triage

**Version:** 1.0 — Phase 1

---

## 1. Design principle

> **AI proposes. Deterministic rules decide. Humans arbitrate.**

Each of the twelve current-state steps is classified as *mechanical* or
*judgement*. Mechanical steps are automated. Judgement steps are preserved and
given a queue, an owner, and a reason — so that escalation is a designed
outcome rather than a breakdown.

The system's job is not to eliminate human involvement. It is to make sure a
human is spending their time only on the cases that need one, and to make it
obvious which those are.

## 2. Target process

```text
Digital intake                       ← structured at the source
      ↓
Automated validation                 ← client-side and server-side
      ↓
AI document extraction               ← probabilistic; per-field confidence
      ↓
Extraction validation                ← schema + required fields + threshold
      ↓
Client match / create                ← normalized email match
      ↓
Duplicate detection                  ← configurable window
      ↓
Deterministic business rules         ← the routing decision
      ↓
Team assignment
      ↓
Submitter confirmation
      ↓
Automation log written               ← every run, success or failure
      ↓
Operations dashboard                 ← queues, ageing, automation health
      ↓
Human review for anything uncertain
```

## 3. Swimlane

```text
SUBMITTER   │ Completes intake form + uploads document ──┐
            │                                            │
            │                    ┌──── Receives acknowledgement (minutes)
────────────┼────────────────────┼───────────────────────────────────────
SYSTEM      │ Validate ▸ Extract ▸ Validate extraction ▸ Match client       │
(automated) │ ▸ Duplicate check ▸ Apply rules ▸ Assign team ▸ Confirm       │
            │ ▸ Write automation log ────────────────────┘                  │
────────────┼───────────────────────────────────────────────────────────────
REVIEW      │              Handles ONLY: low confidence · possible duplicate
QUEUE       │              · missing required data · unknown routing
(human)     │              Corrects, confirms, releases
────────────┼───────────────────────────────────────────────────────────────
EXCEPTION   │              Handles ONLY: extraction failure · service error
QUEUE       │              · write failure. Retry or resolve manually.
(human)     │
────────────┼───────────────────────────────────────────────────────────────
OWNING TEAM │                              Receives a routed, validated record
────────────┼───────────────────────────────────────────────────────────────
OPERATIONS  │  Live queue depth, ageing, straight-through rate, top errors
LEAD        │
```

Compare against the current-state swimlane: the operations lead lane changes
from "no systemic view" to a live one. That is P-7 addressed structurally, not
by adding a report.

## 4. What is automated, and what is not

| Current step | Disposition | Mechanism |
|---|---|---|
| 1. Read email for intent | **Removed** | Intent is captured as a structured field (Quote / Claim) at intake |
| 2. Download + open attachment | **Automated** | Upload posted to the server; processed in memory |
| 3. Read document for fields | **Automated, gated** | Azure AI Document Intelligence with per-field confidence |
| 4. Search CRM for client | **Automated** | Normalized email lookup |
| 5. Judge whether match is correct | **Retained (human)** | Exact normalized-email match is automatic; anything weaker escalates |
| 6. Scan for duplicate submission | **Automated, gated** | Client + type + line of business + configurable window |
| 7. Create submission record | **Automated** | — |
| 8. Retype policy fields | **Removed** | Extraction populates them; low confidence goes to review |
| 9. Determine owning team | **Automated** | Deterministic rules table |
| 10. Forward / assign | **Automated** | Team assignment on the record |
| 11. Acknowledge submitter | **Automated** | Confirmation event on successful routing |
| 12. Track status | **Automated** | Status field + automation log + dashboard |

**Retained for humans:** ambiguous client matching, duplicate adjudication,
low-confidence field correction, unknown-routing decisions, and exception
resolution. These are the judgement calls from the current state — kept, but
now with a queue, a reason, and an SLA instead of a sticky note.

## 5. Decision points

Every branch in the workflow is explicit. There is no implicit fall-through.

| # | Decision | Yes | No |
|---|---|---|---|
| D-1 | Does the submission pass server-side validation? | Continue | Reject with field-level errors; nothing is created |
| D-2 | Is a document attached? | Extract | Continue on form fields alone; no extraction record |
| D-3 | Did extraction succeed? | Validate it | Exception queue; submission preserved |
| D-4 | Does the extraction satisfy the schema and required fields? | Continue | Intake Correction; values retained, marked unverified |
| D-5 | Is confidence ≥ threshold? | Continue | Review queue; values retained, marked unverified |
| D-6 | Does a client exist for the normalized email? | Link it | Create a new client |
| D-7 | Is there a matching submission inside the duplicate window? | Flag possible duplicate → Review | Continue |
| D-8 | Is there a routing rule for this line of business? | Assign that team | General Intake **and** flag for review |
| D-9 | Did the record write succeed? | Confirm + route | Exception queue; log the failure |

D-8 is worth calling out. An unknown line of business does not fail and does
not silently pick a default — it routes to General Intake *and* flags for
review, so the submission keeps moving while a human is told the rules table
has a gap.

## 6. Status model

```text
        New
         │
         ▼
     Processing ──────────────┬──────────────┬───────────────┐
         │                    │              │               │
         ▼                    ▼              ▼               ▼
      Routed              In Review      Duplicate       Exception
         │                    │              │               │
         │                    └──────┬───────┘               │
         │                           ▼                       │
         │                    (human resolves) ──────────────┘
         │                           │
         └───────────────────────────┴──────────► Closed
```

| Status | Meaning | Who acts |
|---|---|---|
| `New` | Accepted and persisted; workflow not yet started | System |
| `Processing` | Workflow running | System |
| `Routed` | Validated, assigned to a team, submitter confirmed | Owning team |
| `In Review` | Needs human judgement — low confidence, missing data, or unknown routing | Review queue |
| `Duplicate` | Possible duplicate of an existing submission | Review queue |
| `Exception` | Workflow failed — extraction, service, or write failure | Exception queue |
| `Closed` | Resolved; no further action | — |

**No submission is ever discarded.** Every terminal state is either routed to a
team or waiting on a named human queue.

## 7. Before / after

| Dimension | Current | Future |
|---|---|---|
| Entry point | Free-form email | Structured intake form with validation |
| Policy data capture | Manual reading and retyping | AI extraction with per-field confidence |
| Client matching | Free-text name search, judged by eye | Normalized email match; ambiguity escalates |
| Duplicate detection | Manual scan, skipped under load | Deterministic rule over a configurable window |
| Routing | Table held in memory | Deterministic rules, identical for identical inputs |
| Acknowledgement | Batched, often next day | Automatic on routing |
| Uncertainty | Handled ad hoc, stalls | Explicit review and exception queues |
| Failure | Silent — an item simply sits | Logged, statused, and surfaced on the dashboard |
| Visibility | None | Live queues, ageing, automation health, top errors |
| Auditability | None | Full run log per submission, with the step that failed |
| Touch-time | ≈ 12 min every submission | ≈ 2–3 min on escalated cases only |

## 8. Non-goals

Stated so the boundary is unambiguous:

- The system does not make underwriting or coverage decisions.
- The system does not reject submissions on its own judgement. It routes,
  flags, or escalates.
- The system does not auto-merge client records. It links on an exact
  normalized match and otherwise escalates.
- The system does not resolve duplicates. It flags a *possible* duplicate with
  a stated reason and hands it to a person.
- Extraction output is never treated as verified without either passing the
  confidence threshold or being confirmed by a human.

## 9. Measurement

The future state instruments itself. Every metric the current state cannot
produce becomes available because the workflow writes an `AutomationLog` record
per run:

| Metric | Source |
|---|---|
| Submissions per day, by line of business | `Submission` |
| Straight-through rate | Routed without review ÷ total |
| Median receipt → routed | `AutomationLog.started` → `completed` |
| Median receipt → acknowledgement | Confirmation event timestamp |
| Review rate, by cause | `Submission.needsHumanReview` + reason |
| Duplicate rate | `Submission.duplicateFlag` |
| Exception rate and top errors | `AutomationLog.status` + `stepFailed` |
| Ageing of open review items | `Submission.status` + `dateReceived` |

Straight-through rate is the metric the business case rests on, and it is the
one to watch in a pilot.

---

**Next:** [`requirements.md`](requirements.md)
