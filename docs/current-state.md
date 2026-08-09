# Current State — Manual Insurance Intake

**Version:** 1.0 — Phase 1
**Scope:** Receipt of a commercial submission through assignment to an
internal team and acknowledgement to the submitter.

> Modeled from publicly observable commercial intake patterns. Timings are
> **assumptions for analysis**, not measurements from any organization.

---

## 1. Narrative

A submission arrives by email at a shared intake mailbox. It contains a request
— a quote for a new or renewing risk, or a claim notification — and usually one
or more attachments: a declarations page, an ACORD application, a loss run, a
certificate.

An intake coordinator works the mailbox in arrival order. For each message they
open the email, read it for intent, download and open the attachment, and read
the document for the fields that matter: named insured, carrier, policy number,
effective and expiration dates, coverage limits, and policy type. They switch
to the CRM and search for the client, usually by company name, sometimes by
email. They judge whether a returned record is the same client. They scan the
client's recent submissions to decide whether this request has already been
received. They create a submission record and retype the policy fields into it.
They determine, from the line of business, which internal team owns the
request. They forward the email to that team or assign the record. They reply
to the submitter confirming receipt. If anything is ambiguous — an unreadable
scan, a missing policy number, an unfamiliar client name — they set the message
aside and return to it later.

Nothing about this is unusual. It is the standard shape of the work.

## 2. Process flow

```text
Email received in shared intake mailbox
      ↓
Coordinator opens email and reads for intent
      ↓
Downloads and opens attachment
      ↓
Reads document for policy fields
      ↓
Switches to CRM, searches for client
      ↓
      ├── Found     → judges whether it is the same client
      └── Not found → creates a new client record
      ↓
Manually scans recent submissions for a duplicate
      ↓
Creates submission record
      ↓
Retypes policy fields from the document
      ↓
Determines owning team from line of business
      ↓
Forwards / assigns to that team
      ↓
Replies to submitter acknowledging receipt
      ↓
Tracks status manually (spreadsheet, mailbox folder, or memory)
```

## 3. Swimlane

```text
SUBMITTER      │ Sends email + attachment ─────────────────────┐
               │                                               │
               │                          ┌────── Receives acknowledgement
───────────────┼───────────────────────────────────────────────┼───────────
INTAKE         │ Open ▸ Read ▸ Download ▸ Read doc ▸ Search CRM │
COORDINATOR    │ ▸ Match/create client ▸ Check duplicates       │
               │ ▸ Create submission ▸ Retype fields            │
               │ ▸ Determine team ▸ Forward ▸ Acknowledge ──────┘
───────────────┼───────────────────────────────────────────────────────────
CRM            │        Client search        Client create   Submission create
───────────────┼───────────────────────────────────────────────────────────
OWNING TEAM    │                                    Receives forwarded request
───────────────┼───────────────────────────────────────────────────────────
OPERATIONS     │ No systemic view. Status lives in a mailbox, a spreadsheet,
LEAD           │ or a coordinator's head.
```

The last lane is the finding that matters most. There is no system of record
for *the work itself* — only for its output. Queue depth, ageing, and failure
causes are not observable.

## 4. Step analysis

| # | Step | Actor | System | Est. time | Nature | Pain |
|---|---|---|---|---|---|---|
| 1 | Open email, read for intent | Coordinator | Mail | 1 min | Judgement | Intent is often implicit |
| 2 | Download + open attachment | Coordinator | Mail / viewer | 0.5 min | Mechanical | Multiple formats, scans |
| 3 | Read document for fields | Coordinator | Viewer | 3 min | Mechanical | Layout varies by carrier |
| 4 | Search CRM for client | Coordinator | CRM | 1.5 min | Mechanical | Name variants defeat search |
| 5 | Judge whether match is correct | Coordinator | CRM | 1 min | **Judgement** | Genuinely requires a person |
| 6 | Scan for duplicate submission | Coordinator | CRM | 1.5 min | Mechanical | Easily skipped under load |
| 7 | Create submission record | Coordinator | CRM | 1 min | Mechanical | — |
| 8 | Retype policy fields | Coordinator | CRM | 2 min | Mechanical | Primary transcription-error source |
| 9 | Determine owning team | Coordinator | Knowledge | 0.5 min | Mechanical | A lookup table held in memory |
| 10 | Forward / assign | Coordinator | Mail / CRM | 0.5 min | Mechanical | — |
| 11 | Acknowledge submitter | Coordinator | Mail | 1 min | Mechanical | Often batched, so delayed |
| 12 | Track status | Coordinator | Ad hoc | — | Mechanical | No system of record |

**Total ≈ 12 minutes** of touch-time per submission.
**Judgement steps: 5 and part of 1 (≈ 2 min).** The remaining ≈ 10 minutes is
mechanical, of which the automation targets roughly 9.

Elapsed time is materially longer than touch-time. Submissions wait in the
mailbox queue, and anything ambiguous is deferred and re-read later — the
document is effectively read twice.

## 5. Pain points

| ID | Pain point | Root cause | Consequence |
|---|---|---|---|
| P-1 | Throughput is capped by headcount | Every submission requires a full manual pass | Turnaround degrades exactly when volume spikes |
| P-2 | Transcription errors | Manual retyping of policy fields (step 8) | Wrong policy numbers and dates propagate downstream |
| P-3 | Duplicate client records | Free-text name search, no normalized matching | Fragmented account view, unreliable reporting |
| P-4 | Missed duplicate submissions | Manual scan, first thing dropped under load | Duplicate work; two teams touch one request |
| P-5 | Inconsistent routing | Routing table lives in individual memory | Misroutes; slow reassignment; edge cases handled differently by different people |
| P-6 | Delayed acknowledgement | Batched at end of day, or forgotten | Poor submitter experience; avoidable status chasing |
| P-7 | No operational visibility | Work state is not recorded anywhere | Queue depth, ageing, and error patterns are invisible to the operations lead |
| P-8 | No audit trail | Nothing records *why* a submission was routed where it was | Cannot reconstruct a decision after the fact |
| P-9 | Ambiguity handling is ad hoc | No defined exception path | Items stall indefinitely with no owner or SLA |
| P-10 | Knowledge concentration | Routing and matching heuristics are undocumented | Onboarding is slow; absence is disruptive |

## 6. Data quality issues originating here

- **Client duplication** — "ACME Trucking LLC", "Acme Trucking, LLC", and
  "ACME Trucking" become three records because matching is done by eye on a
  free-text search.
- **Field transposition** — policy numbers and dates retyped by hand.
- **Inconsistent enumerations** — line of business entered as free text or
  chosen inconsistently, so reporting cannot be trusted.
- **Missing provenance** — a stored policy number carries no record of whether
  it was read from a clean PDF or a poor scan, so downstream users cannot
  calibrate their trust in it.
- **Lost documents** — the source attachment stays in the mailbox rather than
  being attached to the record.

## 7. Metrics that cannot currently be produced

Not "metrics that look bad" — metrics that **do not exist**, because the
process produces no data about itself:

- Submissions received per day, by line of business
- Median and 90th-percentile receipt → routed time
- Median receipt → acknowledgement time
- Re-route rate after initial assignment
- Duplicate rate, and where duplicates are caught
- Volume of items stalled in ambiguity, and their age
- Per-step failure causes

Instrumenting the process is therefore a deliverable in its own right, not a
side effect of automating it.

## 8. Constraints carried into the future state

- Client matching is a judgement call at the margin. The future state may
  automate the *unambiguous* match and must escalate the ambiguous one.
- Documents are heterogeneous: native PDFs, scans, photographs, and
  carrier-specific layouts. Extraction quality will vary and the system must
  express that variance rather than hide it.
- Not every submission has a document. The workflow must complete without one.
- Some lines of business will not map to a known team. Unknown routing must
  have a defined destination rather than an undefined one.

---

**Next:** [`future-state.md`](future-state.md)
