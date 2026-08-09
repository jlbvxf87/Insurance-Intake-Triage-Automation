# Error Handling and Human Review

**Version:** 1.0 — Phase 6
**Implementation:** [`lib/workflow/orchestrator.ts`](../lib/workflow/orchestrator.ts), [`lib/workflow/state-machine.ts`](../lib/workflow/state-machine.ts), [`lib/workflow/review.ts`](../lib/workflow/review.ts)

---

## 1. Principle

> **No workflow step fails silently** (FR-033).

Every failure produces three things: a status that is not `Processing`, an
automation log entry naming the step that failed, and a queue where a person
can act on it. A submission that fails is never lost, and a failure that is not
visible is treated as a defect.

The corollary matters as much: **escalation is not failure.** A run that
correctly sent a low-confidence extraction to a human did its job. It is
logged as `Needs Review`, not `Failed`, so the automation-health panel does not
read as broken every time the system does the right thing.

## 2. TRY / CATCH / FINALLY

Both implementations use the same shape.

| Power Automate | TypeScript |
|---|---|
| `Scope: TRY` | `try { … }` |
| `Scope: CATCH`, configure run after: **has failed, is skipped, has timed out** | `catch (error) { … }` |
| `Scope: FINALLY`, configure run after: **is successful, has failed, is skipped, has timed out** | `finally { … }` |

FINALLY runs after CATCH regardless of how CATCH itself ended. That is what
guarantees an automation log row exists for every run (FR-032) — including runs
where the error handling itself went wrong.

```text
        ┌──────────┐
        │   TRY    │
        └────┬─────┘
     ok      │      failed / skipped / timed out
      │      │              │
      │      └──────────────┤
      │                     ▼
      │              ┌──────────┐
      │              │  CATCH   │  status = Exception
      │              │          │  capture failing step
      │              │          │  notify operations
      │              └────┬─────┘
      │                   │
      └───────────────────┤
                          ▼
                   ┌──────────┐
                   │ FINALLY  │  always
                   │          │  write automation log
                   └──────────┘
```

## 3. Failure matrix

Every failure mode, where it is caught, and where the submission ends up.

| # | Failure | Detected at | Status | Log status | Queue | Record created? | Test |
|---|---|---|---|---|---|---|---|
| 1 | Unsupported file type | API route, before any write | *rejected 400* | — | — | **No** | TC-07 |
| 2 | Oversize file | API route, before any write | *rejected 400* | — | — | **No** | TC-07 |
| 3 | Empty file | API route | *rejected 400* | — | — | **No** | TC-07 |
| 4 | Missing required form field | API route (Zod) | *rejected 400* | — | — | **No** | TC-18 |
| 5 | Malformed email | API route (Zod) | *rejected 400* | — | — | **No** | TC-19 |
| 6 | Azure service error (5xx) | Extraction adapter, after retries | `Exception` | `Failed` | Exceptions | Yes | TC-08 |
| 7 | Azure timeout | Extraction adapter, at the deadline | `Exception` | `Failed` | Exceptions | Yes | TC-08b |
| 8 | Malformed Azure response | Response schema validation | `Exception` | `Failed` | Exceptions | Yes | TC-08c |
| 9 | No recognizable fields | Normalization | `Exception` | `Failed` | Exceptions | Yes | TC-08c |
| 10 | Azure not configured | Adapter, before the call | `Exception` | `Failed` | Exceptions | Yes | — |
| 11 | Low confidence | Confidence gate | `In Review` | `Needs Review` | Needs Review | Yes | TC-06 |
| 12 | Missing required extracted field | Required-field check | `In Review` | `Needs Review` | Needs Review | Yes | TC-13 |
| 13 | Possible duplicate | Duplicate check | `Duplicate` | `Needs Review` | Duplicates | Yes | TC-04 |
| 14 | Unknown line of business | Routing | `In Review` | `Needs Review` | Needs Review | Yes | TC-09 |
| 15 | Policy type mismatch | Cross-field check | `In Review` | `Needs Review` | Needs Review | Yes | TC-10 |
| 16 | Record write failure | CATCH | `Exception` | `Failed` | Exceptions | Partial | TC-14 |
| 17 | Log write failure | FINALLY | unchanged | — | — | Yes | — |
| 18 | Unhandled exception | CATCH | `Exception` | `Failed` | Exceptions | Yes | TC-14 |

**Rows 1–5 create nothing.** Validation runs before the first write, so a
rejected submission leaves no partial state to clean up (AC-007).

**Row 16 is partial by necessity.** If the write that fails is the *first*
one, there may be no submission record to update. The submission id is
allocated before that write specifically so the automation log still references
a traceable identifier rather than being orphaned.

**Row 17 is the honest limit.** If the log store itself is unavailable, nothing
further can be recorded through it. The log record is still returned to the
caller, so the failure surfaces in the response rather than vanishing — but a
production deployment would want a second sink (Application Insights, a queue)
for exactly this case. Recording the gap is more useful than pretending it does
not exist.

## 4. Retry policy

| Condition | Retried | Attempts | Backoff |
|---|---|---|---|
| HTTP 5xx | Yes | 3 | Exponential from 1 s |
| HTTP 429 | Yes | 3 | Exponential from 1 s |
| HTTP 4xx (other) | **No** | 1 | — |
| Timeout | **No** | — | — |
| Malformed response | **No** | 1 | — |
| Dataverse write failure | **No** | 1 | — |

A 4xx that is not 429 means the request was wrong — a bad key, an unsupported
document — and it will be wrong again. Retrying wastes the caller's deadline
and delays the escalation a human is waiting on.

A timeout is not retried because the deadline covers the *whole operation*. By
definition there is no time left.

Dataverse writes are not retried automatically: a write failure may be a
constraint violation, and retrying a violation produces the same violation. An
operator retries from the Exceptions queue after seeing what went wrong.

## 5. Status model

```text
        New
         │
         ▼
     Processing ──────────────┬──────────────┬───────────────┐
         │                    │              │               │
         ▼                    ▼              ▼               ▼
      Routed              In Review      Duplicate       Exception
         │  ▲                 │  ▲           │  ▲            │
         │  └─────────────────┤  └───────────┤  └────────────┤
         │                    │              │               │
         └────────────────────┴──────────────┴───────────────┘
                                    │
                                    ▼
                                  Closed
```

Allowed transitions, enforced by `lib/workflow/state-machine.ts`:

| From | To |
|---|---|
| `New` | Processing, Exception |
| `Processing` | Routed, In Review, Duplicate, Exception |
| `Routed` | In Review, Closed |
| `In Review` | Routed, Duplicate, Closed |
| `Duplicate` | Routed, In Review, Closed |
| `Exception` | Processing *(retry)*, In Review, Routed, Closed |
| `Closed` | — terminal |

**Why the transitions are declared rather than implied.** Without an explicit
table, a bug in a review handler could move an `Exception` straight to `Closed`
and the audit trail would show a transition the design never intended.
Declaring them makes an invalid move an error at the point it is attempted.

**Why `Closed` is terminal.** Reopening creates a new submission rather than
resurrecting a closed one, so the record of what was decided, and when, stays
intact.

## 6. Human review queues

| Queue | Contains | The judgement being asked for |
|---|---|---|
| **Needs Review** | Low confidence, missing required data, unknown routing, policy type mismatch | Are these values right? Where should this go? |
| **Duplicates** | Possible duplicates | Is this the same request as the earlier one? |
| **Exceptions** | Extraction and write failures | What went wrong, and can it be reprocessed? |

Each queue holds one kind of decision. A reviewer working the Duplicates queue
is answering one question repeatedly, which is faster and more consistent than
working a single mixed queue where the question changes every row.

### Review actions

| Action | Effect | Confirmation sent? |
|---|---|---|
| **Release** | Applies routing rules, clears review flags, status → `Routed` | Yes |
| **Correct extraction** | Updates extracted values, validation status → `Validated`. **Status unchanged** | No |
| **Dismiss duplicate** | Clears the duplicate flag and reason, status → `Routed` | Yes |
| **Confirm duplicate** | Status → `Closed` with the duplicate reason retained | No |
| **Close** | Status → `Closed` without routing | No |

Correcting extracted data does *not* release the submission. Correcting and
releasing are separate deliberate acts, so a reviewer can fix a policy number
without committing to the routing decision in the same click.

Every review action writes an automation log entry naming the actor and what
changed. The audit trail does not go quiet the moment a human takes over —
which is the point at which most workflows stop recording anything.

### What review actions deliberately cannot do

- **Change the line of business.** That would silently re-route a submission
  after the fact. A different line of business is a different request.
- **Delete a submission.** No path removes a business record.
- **Merge clients.** Flagged for a data owner, never automatic (FR-019).
- **Edit extraction confidence.** It records what the model reported.
  Overwriting it would erase the evidence that the model struggled with this
  document — which is exactly the signal needed to decide whether a custom
  model is worth training.

## 7. Notification

| Event | Recipient | Channel |
|---|---|---|
| Submission routed | Submitter | Email (V2) |
| Submission released after review | Submitter | Email (V2) |
| Exception raised | Operations | Teams — operations channel |
| Exception unresolved > 4 hours | Operations lead | Teams — escalation |

The submitter is **not** notified when a submission enters review or is flagged
as a duplicate. A person is about to look at it, and telling the client their
request is "under review" invites a status-chasing call before anyone has
actually looked.

## 8. Monitoring

The operations dashboard reads directly from `iit_automationlog`:

| Panel | Query |
|---|---|
| Automation health | Count by `iit_runstatus` over the period |
| Top errors | Count by `iit_stepfailed`, descending |
| Queue depth | Count of submissions by status |
| Ageing | Oldest `iit_datereceived` where status is a human queue |

`stepFailed` is a Choice column rather than free text specifically so "top
errors" is a reliable group-by. Free-text error strings vary by run and would
never aggregate.

## 9. Alerting thresholds

| Signal | Threshold | Action |
|---|---|---|
| Exception rate | > 5% of runs in an hour | Notify operations lead |
| Same `stepFailed` | 3 consecutive runs | Notify operations lead — likely a service issue |
| Review queue depth | > 20 items | Notify operations lead |
| Oldest exception | > 4 hours | Escalate |
| Straight-through rate | < 50% for a day | Review the confidence threshold |

The last one is the business-case metric. A collapsing straight-through rate
means either document quality has changed or the threshold is set wrong, and
both are worth knowing about the same day rather than at the next review.

---

**Related:** [`workflow.md`](workflow.md) · [`expressions.md`](expressions.md) · [`../docs/test-plan.md`](../docs/test-plan.md)
