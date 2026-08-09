# Business Case

**Project:** Insurance Intake & Triage Automation
**Author:** Jaron Baston
**Type:** Self-directed case study
**Version:** 1.0 — Phase 1

> **Note on figures.** This is a case study, not an engagement. No proprietary
> operational data was used. Every quantity in this document is a **modeled
> assumption**, labeled as such, sourced from publicly observable industry
> patterns and stated explicitly so a reader can substitute their own numbers.
> The purpose of the model is to show *how* the case would be argued and which
> variables drive it — not to assert a specific saving.

---

## 1. Problem statement

Commercial insurance submissions arrive as unstructured work. A quote request
or first notice of loss reaches a shared mailbox with a declarations page, an
ACORD form, or a loss run attached. Before anything underwriting-relevant can
happen, a person has to convert that email into a record: read the attachment,
identify the insured, find or create the client in the CRM, decide whether the
request has already been seen, retype policy details, determine which team owns
the line of business, forward it, and acknowledge receipt.

That conversion work has four properties that make it a strong automation
candidate:

1. **It is high-volume and repetitive.** The same eight or nine steps run on
   every submission regardless of complexity.
2. **It is mechanical, not analytical.** Reading a policy number off a
   declarations page is transcription. It is not underwriting judgement.
3. **It is a queue, so it fails under load.** Intake throughput is bounded by
   headcount. Volume spikes — renewal season, a catastrophe event — push
   turnaround out precisely when responsiveness matters most.
4. **It is where data quality is decided.** Duplicate client records,
   misrouted submissions, and transposed policy numbers almost all originate
   at intake, and every downstream system inherits them.

The cost is not only the labor. It is the acknowledgement that arrives a day
late, the submission that sits in the wrong team's queue for three days, and
the duplicate client record that fragments the account view.

## 2. Why not simply "add AI"

The obvious framing — point a document AI at the mailbox — is the wrong one,
and stating why is central to this case.

Document extraction is probabilistic. It returns a value *and a confidence*.
A system that treats a 62%-confidence policy number the same as a
98%-confidence one has not removed manual work; it has moved the error
downstream to somewhere more expensive to fix, and removed the human who used
to catch it.

The design position taken here:

> **AI proposes. Deterministic rules decide. Humans arbitrate.**

- **AI proposes** — extraction converts a document into candidate field values
  with per-field confidence.
- **Deterministic rules decide** — routing is a pure function of validated
  inputs. Given the same line of business, the system always produces the same
  team. That property is what makes the workflow auditable and testable.
- **Humans arbitrate** — low confidence, possible duplicates, missing required
  data, and unrecognized values escalate to a review queue rather than being
  resolved by a guess.

This is what makes the automation defensible to an operations lead, a
compliance reviewer, and an auditor asking why a given submission went where it
went.

## 3. Objectives

| # | Objective | Measured by |
|---|---|---|
| OBJ-1 | Reduce manual handling time per submission | Median operator touch-time, intake receipt → routed |
| OBJ-2 | Reduce time to acknowledgement | Median receipt → acknowledgement sent |
| OBJ-3 | Improve routing accuracy | % of submissions re-routed after initial assignment |
| OBJ-4 | Reduce duplicate client and submission records | Duplicates detected at intake vs discovered downstream |
| OBJ-5 | Make intake auditable | % of submissions with a complete workflow run log |
| OBJ-6 | Preserve human judgement where it matters | % of uncertain cases correctly escalated, not auto-decided |

OBJ-6 is deliberately framed as a *ceiling* on automation. A system that
escalates nothing is a failure mode, not a success.

## 4. Opportunity model

All inputs below are **assumptions for illustration**. The model is the
deliverable; the numbers are placeholders.

**Inputs**

| Variable | Assumed value | Notes |
|---|---|---|
| Submissions per business day | 120 | Mid-size commercial book |
| Business days per year | 250 | — |
| Manual touch-time per submission | 12 min | Open, read, search CRM, retype, route, acknowledge |
| Portion of touch-time that is mechanical | 75% | Transcription, search, routing lookup, acknowledgement |
| Extraction straight-through rate | 70% | Remainder escalates to review |
| Fully loaded operations cost | $38 / hour | — |

**Derivation**

```text
Annual submissions        = 120 × 250                    = 30,000
Mechanical minutes each   = 12 × 0.75                    = 9 min
Automatable share         = 9 min × 70% straight-through = 6.3 min
Annual minutes recovered  = 30,000 × 6.3                 = 189,000 min
Annual hours recovered    = 189,000 / 60                 = 3,150 hours
Indicative annual value   = 3,150 × $38                  ≈ $119,700
```

**How to read this.** The result is far less interesting than its
sensitivity. Straight-through rate is the dominant variable: at 40% rather than
70% the recovered hours fall to roughly 1,800. That is the number worth
measuring in a pilot, and it is why the confidence threshold is configurable
rather than hard-coded — it is the primary tuning lever between automation
benefit and error risk.

The non-modeled benefits are plausibly larger and harder to attribute:
same-hour acknowledgement instead of next-day, fewer misroutes, and a clean
audit trail on every run.

## 5. Scope

**In scope**

- Digital intake for quote requests and claims
- Document upload with validation (type, size, presence)
- Automated extraction of policy fields from a supporting document
- Client search and creation, with normalized matching
- Duplicate submission detection inside a configurable window
- Deterministic routing by line of business
- Human review queues for low confidence, duplicates, and exceptions
- Acknowledgement to the submitter
- Workflow run logging for every attempt, successful or failed
- Operations dashboard with queues, filters, and automation health

**Out of scope**

- Underwriting decisions, pricing, appetite, or bind authority
- Claims adjudication or reserving
- Policy administration and issuance
- Carrier or rating integrations
- Payment processing
- Production email ingestion (this case study uses a web intake form; email
  ingestion is documented as the natural extension, not implemented)

**Explicitly excluded by design**

- Any path where an AI-extracted value becomes the sole basis for a routing
  decision without a deterministic rule and a confidence gate.

## 6. Options considered

| Option | Description | Assessment |
|---|---|---|
| **A. Do nothing** | Keep manual intake | No cost to implement. Throughput stays bounded by headcount; data-quality issues continue to originate at intake. Baseline. |
| **B. Digital form only** | Replace email with a structured web form; no extraction | Cheap, removes retyping of *contact* fields. Does not address the document, which is where policy data lives. Partial. |
| **C. Full AI autonomy** | Extraction drives routing directly, no thresholds | Highest theoretical automation. Rejected: unauditable, silently wrong under low confidence, and removes the human at exactly the point judgement is required. |
| **D. AI-assisted, rule-governed** *(selected)* | Extraction proposes, deterministic rules route, thresholds escalate to humans | Captures the mechanical work, keeps the decision auditable and testable, and fails safely toward human review. |

Option D is selected. The rejection of Option C is the substantive decision in
this project.

## 7. Success criteria

The project is successful when all of the following are demonstrable, not
described:

- A submission can be created through digital intake with validation on both
  the client and the server.
- An uploaded document is processed and normalized into a defined schema.
- Extraction confidence below the configured threshold routes to human review
  and does **not** auto-route.
- An existing client is matched on normalized email rather than duplicated.
- A repeat submission inside the duplicate window is flagged with a stated
  reason.
- Routing is deterministic and identical for identical inputs.
- Every one of the eight failure modes in the test plan produces a logged,
  non-silent outcome.
- The operations dashboard reflects live queue state.
- Every claim made on the public case-study page is executable by a reader.

## 8. Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-1 | Extraction accuracy below expectation on real documents | Straight-through rate collapses; benefit does not materialize | Confidence threshold is configurable; per-field confidence retained; measure before committing to a target |
| R-2 | Over-automation erodes trust after a visible bad route | Operations reverts to manual handling | Deterministic rules only; escalate on any uncertainty; full run log for every submission |
| R-3 | Duplicate rule too aggressive | Legitimate submissions stall in review | Flag as *possible* duplicate with a stated reason and human decision — never auto-reject |
| R-4 | Azure service outage or timeout | Submissions cannot be processed | Extraction failure is caught, logged, and routed to the Exception queue; the submission is never lost |
| R-5 | Credential exposure | Security incident | Server-side-only configuration, no `NEXT_PUBLIC_` variables, `.env` gitignored, enforced by an automated test |
| R-6 | Schema drift between the reference and Dataverse implementations | Documentation stops matching reality | Field names, enums, and status vocabulary shared across both; mapping documented in `power-automate/` |

## 9. Stakeholders

| Stakeholder | Interest | What they need from this system |
|---|---|---|
| Intake / operations team | Daily users | Fewer mechanical steps; a clear queue; confidence that nothing is silently dropped |
| Underwriting / claims teams | Downstream recipients | Correctly routed submissions with complete, validated data |
| Operations lead | Throughput and SLA | Visible queue depth, automation health, and top failure causes |
| Data / CRM owner | Record quality | Fewer duplicate clients; normalized, validated fields |
| Compliance / audit | Traceability | A complete run log and an explainable routing decision per submission |
| Submitting client | Service | Immediate acknowledgement and correct handling |

## 10. Recommendation

Proceed with Option D. Build the intake, extraction, duplicate detection,
deterministic routing, exception handling, and operations dashboard as a
working reference implementation, with the Power Platform equivalent
documented action-by-action. Instrument the straight-through rate from day one,
since it is the variable the entire business case rests on.

---

**Related documents**

- [`current-state.md`](current-state.md) — the manual process as it exists
- [`future-state.md`](future-state.md) — the target process
- [`requirements.md`](requirements.md) — functional and non-functional requirements
- [`acceptance-criteria.md`](acceptance-criteria.md) — Given/When/Then criteria
- [`test-plan.md`](test-plan.md) — test cases and results
