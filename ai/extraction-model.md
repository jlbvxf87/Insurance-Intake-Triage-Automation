# Document Extraction — Model and Approach

**Version:** 1.0 — Phase 4
**Service:** Azure AI Document Intelligence
**Implementation:** [`lib/extraction/`](../lib/extraction)

---

## 1. Position of AI in this system

Extraction converts a document into *candidate* field values with per-field
confidence. That is the whole of its job. It does not decide routing, it does
not decide whether a submission is a duplicate, and it does not override a
value the submitter supplied.

> **AI proposes. Deterministic rules decide. Humans arbitrate.**

The concrete consequence, tested in `tests/workflow.test.ts`: a document whose
extracted `policyType` is *Workers Compensation* attached to a submission whose
line of business is *Property* still routes to the Property Team. The
disagreement becomes a review reason for a human — it does not change the
assignment (FR-030).

## 2. Model selection

**Default: `prebuilt-document`.**

| Option | Assessment |
|---|---|
| `prebuilt-document` *(selected)* | No training required. Returns generic key/value pairs plus per-pair confidence. Works on the first document, on any carrier layout, with no labelled corpus. |
| `prebuilt-layout` | Structure and tables but no key/value semantics. Would push all field identification into our own code. |
| `prebuilt-invoice` / `prebuilt-receipt` | Trained for a different document class. Fields do not correspond to policy data. |
| Custom-trained model | Best accuracy on a known layout, but requires a labelled corpus per carrier form. The right answer *at volume*, not at project start. |

This resolves **Q-1** from the architecture note. The reasoning:
`prebuilt-document` is the correct starting point because it needs no training
data, and the adapter reads the model id from configuration
(`AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID`), so replacing it with a custom-trained
ACORD model later is a configuration change, not a rewrite. The normalization
layer already handles both response shapes — `documents[].fields` from a
trained model and `keyValuePairs` from the prebuilt one — so it does not need
to change either.

## 3. Prompting and why there is none

Document Intelligence is not a prompted LLM. There is no instruction to write:
the model returns structured output, and the work is in *interpreting* that
output reliably. This project's equivalent of prompt engineering is the label
alias table in [`lib/extraction/normalize.ts`](../lib/extraction/normalize.ts),
which maps the label variants that appear on real declarations pages onto our
field names:

```text
"Named Insured" ┐
"Insured"       ├──► namedInsured
"Insured Name"  ┘

"Policy Number" ┐
"Policy No."    ├──► policyNumber
"POLICY #"      ┘

"Carrier"       ┐
"Insurer"       ├──► carrier
"Company"       ┘
```

Labels are normalized to lower-case alphanumerics before matching, so
punctuation and casing do not need their own entries.

**Why not use a general LLM to read the document instead?** It would handle
label variance more gracefully. It would also produce a value with no
calibrated per-field confidence, which is the input the entire human-review
gate depends on. A system that cannot say *how sure it is* cannot decide when
to escalate, and escalation is the safety property this design is built
around. That trade decides it.

## 4. Request path

```text
Browser
   │  multipart/form-data (document + fields)
   ▼
POST /api/submissions          ← Node runtime, this application's own origin
   │
   │  validate fields (Zod) ─── reject 400 before any record is created
   │  validate upload (type, size) ─── reject 400
   ▼
lib/workflow/orchestrator
   │
   ▼
lib/extraction/azure-adapter
   │  POST {endpoint}/documentintelligence/documentModels/{modelId}:analyze
   │       ?api-version=2024-11-30
   │  Ocp-Apim-Subscription-Key: {key}      ← server-side only, never sent to the client
   │  Content-Type: {file mime type}
   │  body: raw bytes
   │
   │  202 Accepted + Operation-Location
   ▼
   │  GET {operation-location}   ← polled until succeeded / failed / deadline
   ▼
azureAnalyzeResultSchema.safeParse()   ← the response is untrusted input
   ▼
normalizeAzureResult()                 ← reduce to NormalizedExtraction
   ▼
normalizedExtractionSchema.safeParse()  ← the normalized result is validated too
```

The browser never contacts Azure (NFR-003). The document is posted to this
application, and the application calls Azure server-side with credentials that
exist only in server environment variables (FR-027).

## 5. Confidence handling

**Aggregate = arithmetic mean of per-field confidences.**

This resolves **Q-2** from the architecture note. Mean rather than minimum: a
single weak ancillary field — an expiration date on a slightly skewed scan —
should not send an otherwise clean extraction to review, because the review
queue only stays useful while the things in it genuinely need a person.
Per-field confidences are retained in full (BR-018), so a reviewer opening the
record still sees exactly which field was weak.

The trade-off is real and worth stating: mean can mask one badly-read field
among several well-read ones. Two things bound that risk — the required-field
check runs independently of confidence (a missing policy number routes to
Intake Correction whatever the aggregate says), and per-field values are
visible to the reviewer. If production data showed the mean masking failures,
the fix is a per-field floor in addition to the aggregate, which is a change
to one function.

| Aggregate | Validation status | Outcome |
|---|---|---|
| ≥ threshold, all required fields present | `Validated` | Routes normally |
| < threshold | `Unverified` | Values retained, `needsHumanReview`, status `In Review` |
| Any required field missing | `Failed` | Values retained, status `In Review` (Intake Correction) |
| Response unparseable | — | Extraction failure, status `Exception` |

Threshold default 0.80, **inclusive** — confidence exactly at the threshold is
accepted. Configurable via `EXTRACTION_CONFIDENCE_THRESHOLD` (BR-017), because
it is the primary operational dial between automation benefit and error risk
and must not require a deployment to change.

## 6. Failure taxonomy

Every failure mode is *returned* rather than thrown, so the orchestrator
classifies outcomes in one place instead of splitting that logic between a
return value and a catch block.

| Kind | Cause | Retried? | Outcome |
|---|---|---|---|
| `timeout` | Whole operation exceeded `AZURE_REQUEST_TIMEOUT_MS` | No — the deadline has passed | `Exception` |
| `service_error` | 5xx or 429 from Azure | Yes, up to 3 attempts with exponential backoff | `Exception` after retries |
| `malformed_response` | Response failed schema validation, or no recognizable fields | No — it will not parse differently next time | `Exception` |
| `unsupported_document` | Document rejected by the service | No | `Exception` |
| `not_configured` | `EXTRACTION_PROVIDER=azure` with no endpoint or key | No | `Exception` |

4xx responses other than 429 are not retried: a malformed request or an invalid
key does not improve on repetition, and retrying wastes the caller's deadline.

The timeout is a deadline for the **whole operation**, submit plus polling, not
per request. A per-request timeout would let a slow poll loop run indefinitely
while each individual call stayed inside its limit.

## 7. Fixture mode

With no Azure credentials configured, `EXTRACTION_PROVIDER=auto` resolves to
the fixture adapter. It satisfies the identical interface and returns the
identical normalized shape, so nothing downstream is aware of the difference —
and every result carries `provider: 'fixture'`, which the UI displays, so
demo output is never presented as a live Azure call.

Fixtures are selected by file name, which makes each path demonstrable on
demand:

| File name contains | Fixture | Demonstrates |
|---|---|---|
| `dec-page`, `declarations`, `acme` | High confidence, 0.94 | Clean straight-through routing |
| `low-confidence`, `scan`, `photo` | Low confidence, 0.62 | Human review on confidence |
| `missing`, `partial` | No policy number, 0.84 | Intake Correction |
| `boundary`, `threshold` | Exactly 0.80 | Inclusive threshold boundary |
| `property`, `building` | Property policy, 0.88 | Property routing |
| `trigger-timeout` | — | Timeout → Exception queue |
| `trigger-error` | — | Service error after retries → Exception queue |
| `trigger-malformed` | — | Schema failure → Exception queue |

The failure triggers exist so the exception paths can be shown in a live demo
without breaking a real service — the alternative is claiming they work and
asking the viewer to take it on trust.

## 8. Data handling

- Document bytes are held in memory for the duration of the request and are
  never written to disk or committed (DR-008).
- Only the file name, MIME type, size, and upload time are persisted on the
  submission.
- No document content is logged. Automation log entries record the provider,
  model, duration, and confidence — never extracted values, which could carry
  client data into a telemetry store with a different retention policy.
- All documents used in this project are synthetic.

---

**Related:** [`validation-rules.md`](validation-rules.md) · [`output-schema.json`](output-schema.json) · [`../power-automate/workflow.md`](../power-automate/workflow.md)
