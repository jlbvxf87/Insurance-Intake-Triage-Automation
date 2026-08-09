# Extraction Validation Rules

**Version:** 1.0 — Phase 4
**Implementation:** [`lib/domain/schemas.ts`](../lib/domain/schemas.ts), [`lib/extraction/normalize.ts`](../lib/extraction/normalize.ts)

Extraction output is untrusted input. It is parsed, not assumed. This document
states every rule applied between the raw service response and a value the
workflow is willing to act on.

---

## 1. Validation stages

```text
Raw Azure response
      │
      ▼  ① azureAnalyzeResultSchema — is this even the right shape?
      │     fail → malformed_response → Exception
      ▼
Field collection + coercion
      │
      ▼  ② normalizedExtractionSchema — did coercion produce a valid result?
      │     fail → malformed_response → Exception
      ▼
Required-field check
      │
      ▼  ③ findMissingRequiredFields — is anything essential absent?
      │     missing → validationStatus Failed → In Review (Intake Correction)
      ▼
Confidence gate
      │
      ▼  ④ aggregate vs threshold
      │     below → validationStatus Unverified → In Review
      ▼
Validated
```

Stages ① and ② produce **failures** — no usable data. Stages ③ and ④ produce
**escalations** — data retained, human involved. That distinction is why a
low-confidence extraction and a broken service response end up in different
queues.

## 2. Stage ① — Response shape

Applied by `azureAnalyzeResultSchema`.

| Rule | Behaviour on violation |
|---|---|
| Body must be a JSON object | `malformed_response` |
| `analyzeResult.documents`, when present, must be an array | `malformed_response` |
| `analyzeResult.keyValuePairs`, when present, must be an array | `malformed_response` |
| `documents[].fields` must be an object of field objects | `malformed_response` |
| Unknown properties | **Ignored** |

Unknown properties are ignored deliberately. Azure adds fields to this response
over time; rejecting an additive change would break intake for a reason that
has nothing to do with the document. Only the structures this system actually
reads are enforced.

## 3. Stage ② — Field coercion

Applied during normalization, then checked by `normalizedExtractionSchema`.

### Text fields — `namedInsured`, `policyNumber`, `carrier`

| Rule | Behaviour |
|---|---|
| Trim surrounding whitespace | Applied |
| Empty after trimming | Becomes `null` |
| No maximum length enforced | Accepted as returned |

`policyNumber` is **not** normalized beyond trimming. Formats are
carrier-specific — `CA-829103`, `WC-55120-B`, `PR/3390188` — and stripping
punctuation to "tidy" them would destroy information a downstream system needs
to match the carrier's own records.

### Dates — `effectiveDate`, `expirationDate`

Accepted input, normalized to `YYYY-MM-DD`:

| Input | Result |
|---|---|
| `2026-01-01` | `2026-01-01` |
| `01/01/2026`, `1/1/2026` | `2026-01-01` |
| `01-01-26` | `2026-01-01` |
| `January 1, 2026` | `2026-01-01` |
| Anything unparseable | `null` |

Two-digit years are expanded to `20xx`. Documented as a limitation rather than
solved: a policy dated `01/01/26` is far more likely to mean 2026 than 1926 in
this domain, but the assumption is stated here so it is visible rather than
buried.

**Ambiguous formats are a known limitation.** `03/04/2026` is 4 March in most
of the world and 3 April in the United States. This implementation assumes
US convention (month first), matching the domain. A production deployment
handling non-US documents would need the carrier's locale, which is not
available from the document alone.

Date *ordering* is not validated. An expiration before an effective date is
recorded as extracted rather than corrected — silently swapping them would
hide a real extraction error.

### Currency — `coverageAmount`

| Input | Result |
|---|---|
| `$1,000,000` | `1000000` |
| `1.000.000,00` | `1000000` |
| `USD 1000000` | `1000000` |
| `1,000,000.50` | `1000000.5` |
| Negative or unparseable | `null` |

The decimal separator is decided by whichever of `.` or `,` appears last,
which handles both European and US conventions without needing a locale.

### Policy type — `policyType`

Free text is mapped onto the constrained option set. Exact matches win;
otherwise a keyword match applies:

| Contains | Maps to |
|---|---|
| `commercial auto`, `business auto`, `fleet`, `trucking` | Commercial Auto |
| `property`, `building`, `contents` | Commercial Property |
| `general liability`, `cgl`, `liability` | General Liability |
| `workers comp`, `workmans comp`, `wc` | Workers Compensation |
| `umbrella`, `excess` | Umbrella |
| Anything else | **Unknown** |

`Unknown` is a real value, not a failure. A document that does not state its
policy type is common, and the submitted line of business already carries that
information.

### Confidence

| Rule | Behaviour |
|---|---|
| Must be a finite number | Non-numeric → field confidence omitted |
| Clamped to 0–1 | Values outside the range are clamped, not rejected |
| Aggregate = mean of per-field values | Computed after collection |
| No per-field confidences at all | Aggregate is 0 → below any threshold → review |

An extraction that returns values with *no* confidence data collapses to
aggregate 0 and routes to human review. That is the correct failure direction:
a system that cannot say how sure it is should not be trusted to route
automatically.

## 4. Stage ③ — Required fields

| Field | Required | Rationale |
|---|---|---|
| `namedInsured` | **Yes** | Without it the extraction cannot be tied to a party |
| `policyNumber` | **Yes** | The key downstream systems match on |
| `carrier` | **Yes** | Needed to interpret the policy number |
| `effectiveDate` | No | Useful, not blocking |
| `expirationDate` | No | Useful, not blocking |
| `coverageAmount` | No | Frequently absent from the first page |
| `policyType` | No | Defaults to `Unknown`; line of business already supplied |

A missing required field sets `validationStatus = Failed` and routes to
`In Review` with reason *Missing Required Data*. The extracted values that
*were* found are retained — a reviewer with four of six fields filled in is
better off than one starting from the document (FR-024).

Missing field names are recorded in `missingFields` so the review queue can
show what to look for rather than a bare "incomplete".

## 5. Stage ④ — Confidence gate

```text
extractionConfidence >= EXTRACTION_CONFIDENCE_THRESHOLD  →  Validated
extractionConfidence <  EXTRACTION_CONFIDENCE_THRESHOLD  →  Unverified → In Review
```

Inclusive at the boundary. Default 0.80. Tested explicitly at exactly 0.80
(TC-06b), because "below the threshold" is ambiguous in prose and the boundary
is where an off-by-one silently changes behaviour for a whole class of
submissions.

## 6. Cross-field checks

| Check | Outcome |
|---|---|
| Extracted `policyType` implies a different line of business than submitted | Review reason *Policy Type Mismatch*. Routing is **unchanged** (FR-030) |
| `policyType` is `Unknown` or `Umbrella` | No mismatch — neither implies a single line of business |

The mismatch check surfaces a disagreement rather than resolving it. Either the
submitter chose the wrong option or the extraction misread the document, and
deciding which is exactly the judgement call a person should be making.

## 7. What is deliberately not validated

Stated so the boundary is explicit:

- **Policy number format.** No carrier-specific pattern is enforced. A
  plausible-looking number that fails a pattern we invented would be rejected
  for the wrong reason.
- **Date ordering.** See above.
- **Coverage amount plausibility.** No upper or lower bound. A $500 limit and a
  $500,000,000 limit are both real in commercial insurance.
- **Named insured against company name.** They legitimately differ — a policy
  is often held by a parent entity. Comparing them would produce constant false
  flags.

Each of these would trade a rare correct catch for frequent incorrect ones.
Where the system is uncertain, it escalates on confidence rather than
inventing domain constraints it cannot justify.

---

**Related:** [`extraction-model.md`](extraction-model.md) · [`output-schema.json`](output-schema.json) · [`../docs/requirements.md`](../docs/requirements.md)
