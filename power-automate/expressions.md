# Power Automate — Expressions

**Version:** 1.0 — Phase 5

Every non-trivial expression in the flow, with the reference-implementation
equivalent beside it. Paired deliberately: the pair is what proves the two
implementations encode the same rule rather than two similar-looking ones.

---

## 1. Email normalization (FR-017)

```text
toLower(trim(triggerOutputs()?['body/iit_email']))
```

```ts
// lib/utils/normalize.ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
```

Written to the stored `iit_normalizedemail` column rather than computed per
query, so the alternate key can enforce uniqueness and matching stays a key
lookup.

---

## 2. Duplicate candidate filter (BR-013, BR-015)

OData filter on the `List rows` action against `iit_submission`:

```text
_iit_clientid_value eq '@{variables('ClientId')}'
and iit_submissiontype eq @{triggerOutputs()?['body/iit_submissiontype']}
and iit_lineofbusiness eq @{triggerOutputs()?['body/iit_lineofbusiness']}
and iit_status ne 100000005
and iit_datereceived ge @{addDays(utcNow(), mul(-1, int(parameters('iit_DuplicateWindowDays'))), 'yyyy-MM-ddTHH:mm:ssZ')}
and iit_submissionid ne '@{triggerOutputs()?['body/iit_submissionid']}'
```

Line by line:

| Clause | Rule |
|---|---|
| `_iit_clientid_value eq …` | Same client — BR-013 (1) |
| `iit_submissiontype eq …` | Same submission type — BR-013 (2) |
| `iit_lineofbusiness eq …` | Same line of business — BR-013 (3) |
| `iit_status ne 100000005` | Exclude `Exception` — BR-015 |
| `iit_datereceived ge …` | Inside the window — BR-013 (4) |
| `iit_submissionid ne …` | Do not match itself |

```ts
// lib/workflow/duplicate-detection.ts
const match = candidates
  .filter((c) => c.submissionId !== excludeSubmissionId)
  .filter((c) => c.submissionType === submissionType)
  .filter((c) => c.lineOfBusiness === lineOfBusiness)
  .filter((c) => !NON_EVIDENCE_STATUSES.has(c.status))
  .filter((c) => isWithinDays(c.dateReceived, now, windowDays))
  .sort((a, b) => b.dateReceived.localeCompare(a.dateReceived))[0]
```

`Order by: iit_datereceived desc` with `Top count: 1` matches the `.sort()[0]`
— the nearest prior submission is the most useful comparison for a reviewer.

**Duplicate detected**:

```text
greater(length(outputs('List_duplicate_candidates')?['body/value']), 0)
```

**Duplicate reason** (FR-020):

```text
concat(
  'Same client, same submission type (',
  triggerOutputs()?['body/iit_submissiontype@OData.Community.Display.V1.FormattedValue'],
  '), same line of business (',
  triggerOutputs()?['body/iit_lineofbusiness@OData.Community.Display.V1.FormattedValue'],
  '). Previous submission ',
  first(outputs('List_duplicate_candidates')?['body/value'])?['iit_submissionnumber'],
  ' was received ',
  string(div(
    sub(ticks(utcNow()), ticks(first(outputs('List_duplicate_candidates')?['body/value'])?['iit_datereceived'])),
    864000000000
  )),
  ' days ago (window: ',
  string(parameters('iit_DuplicateWindowDays')),
  ' days).'
)
```

`864000000000` is ticks per day (10,000,000 ticks/second × 86,400). Power
Automate has no date-difference function, so tick arithmetic is the idiom.

---

## 3. Aggregate confidence (BR-018)

Mean of the per-field confidences returned by Document Intelligence:

```text
div(
  add(
    add(
      add(body('Parse_extraction')?['namedInsuredConfidence'],
          body('Parse_extraction')?['policyNumberConfidence']),
      add(body('Parse_extraction')?['carrierConfidence'],
          body('Parse_extraction')?['effectiveDateConfidence'])
    ),
    add(body('Parse_extraction')?['expirationDateConfidence'],
        body('Parse_extraction')?['coverageAmountConfidence'])
  ),
  6
)
```

More robustly, over a variable-length field array — which is what the
reference implementation does, and what a custom model with a different field
set requires:

```text
div(
  string(
    reduce(
      body('Select_confidences'),
      0,
      add(item(), iterationIndexes())
    )
  ),
  length(body('Select_confidences'))
)
```

```ts
// lib/extraction/normalize.ts
const confidences = Object.values(fieldConfidence)
const aggregate =
  confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0
```

**Note on parity.** The fixed six-term version is the practical choice inside a
flow when the model's field set is known; the array version generalizes.
Whichever is used, `length(...)` guarding against zero matters — no per-field
confidences yields aggregate 0, which is below any threshold and therefore
routes to review. That is the correct failure direction, and it depends on not
dividing by zero.

---

## 4. Required-field check (BR-010)

```text
empty(
  trim(
    coalesce(body('Parse_extraction')?['namedInsured'], '')
  )
)
```

Collecting the missing field names into a single string:

```text
join(
  filter(
    createArray(
      if(empty(coalesce(body('Parse_extraction')?['namedInsured'], '')), 'namedInsured', ''),
      if(empty(coalesce(body('Parse_extraction')?['policyNumber'], '')), 'policyNumber', ''),
      if(empty(coalesce(body('Parse_extraction')?['carrier'], '')), 'carrier', '')
    ),
    not(equals(item(), ''))
  ),
  '; '
)
```

```ts
// lib/domain/schemas.ts
export const REQUIRED_EXTRACTION_FIELDS = [
  'namedInsured', 'policyNumber', 'carrier',
] as const

export function findMissingRequiredFields(e: NormalizedExtraction): string[] {
  return REQUIRED_EXTRACTION_FIELDS.filter((f) => {
    const v = e[f]
    return v === null || v === undefined || v === ''
  })
}
```

---

## 5. Confidence gate and validation status (BR-007, BR-019)

**Below threshold** — note `less`, not `lessOrEquals`: the threshold is
inclusive, so a value exactly at it passes (AC-006, TC-06b).

```text
less(
  variables('AggregateConfidence'),
  float(parameters('iit_ConfidenceThreshold'))
)
```

**Validation status option-set value**:

```text
if(
  greater(length(variables('MissingFields')), 0),
  100000002,                                        // Failed
  if(
    less(variables('AggregateConfidence'), float(parameters('iit_ConfidenceThreshold'))),
    100000001,                                      // Unverified
    100000000                                       // Validated
  )
)
```

```ts
// lib/workflow/orchestrator.ts
const validationStatus = hasMissingRequiredData
  ? 'Failed'
  : isLowConfidence
    ? 'Unverified'
    : 'Validated'
```

Missing fields outrank low confidence: a complete-but-uncertain result and an
incomplete one need different things from a reviewer, and the more specific
condition should be the one reported.

---

## 6. Outcome precedence (BR-020)

Final status, evaluated in precedence order Exception > Duplicate > In Review >
Routed:

```text
if(
  variables('HasWorkflowError'),
  100000005,                                   // Exception
  if(
    variables('IsPossibleDuplicate'),
    100000004,                                 // Duplicate
    if(
      or(
        or(variables('IsLowConfidence'), variables('HasMissingRequiredData')),
        or(variables('HasUnknownRouting'), variables('HasPolicyTypeMismatch'))
      ),
      100000003,                               // In Review
      100000002                                // Routed
    )
  )
)
```

```ts
// lib/workflow/business-rules.ts
if (input.hasWorkflowError) return { status: 'Exception', … }
if (input.isPossibleDuplicate) return { status: 'Duplicate', … }
if (input.isLowConfidence || input.hasMissingRequiredData ||
    input.hasUnknownRouting || input.hasPolicyTypeMismatch) {
  return { status: 'In Review', … }
}
return { status: 'Routed', needsHumanReview: false, reviewReasons: [] }
```

**Review reasons** are collected independently of the status — precedence
decides the status, it does not discard the other reasons (AC-015):

```text
join(
  filter(
    createArray(
      if(variables('HasWorkflowError'), '100000004', ''),
      if(variables('IsPossibleDuplicate'), '100000001', ''),
      if(variables('IsLowConfidence'), '100000000', ''),
      if(variables('HasMissingRequiredData'), '100000002', ''),
      if(variables('HasUnknownRouting'), '100000003', ''),
      if(variables('HasPolicyTypeMismatch'), '100000005', '')
    ),
    not(equals(item(), ''))
  ),
  ','
)
```

The comma-joined string is the format the multi-select `iit_reviewreasons`
column accepts.

---

## 7. Routing (BR-001 – BR-006)

Implemented as a `Switch` on `iit_lineofbusiness` — see
[`workflow.md`](workflow.md) §4.7. As an expression, for reference:

```text
if(equals(triggerOutputs()?['body/iit_lineofbusiness'], 100000000), 100000000,  // Auto Team
if(equals(triggerOutputs()?['body/iit_lineofbusiness'], 100000001), 100000001,  // Property Team
if(equals(triggerOutputs()?['body/iit_lineofbusiness'], 100000002), 100000002,  // Casualty Team
if(equals(triggerOutputs()?['body/iit_lineofbusiness'], 100000003), 100000003,  // WC Team
                                                                   100000004))))// General Intake
```

The `Switch` is preferred: it reads as the routing table it is, and adding a
line of business is one case rather than another layer of nesting.

---

## 8. Run metadata (FR-034)

```text
Run ID:      workflow()['run']['name']
Flow name:   workflow()['tags']['flowDisplayName']
Started:     triggerOutputs()?['headers']['x-ms-workflow-run-start-time']
Completed:   utcNow()
Duration ms: div(sub(ticks(utcNow()), ticks(variables('StartedAt'))), 10000)
```

`10000` ticks per millisecond.

---

## 9. Failure identification (FR-009)

`result('TRY')` returns the outcome of every action in the scope. Filtering it
is what makes `stepFailed` name the actual failing action rather than a generic
"the flow failed":

```text
first(
  filter(
    result('TRY'),
    equals(item()?['status'], 'Failed')
  )
)?['name']
```

Error message:

```text
first(
  filter(result('TRY'), equals(item()?['status'], 'Failed'))
)?['error']?['message']
```

Full step trace, stored as JSON in `iit_steptrace`:

```text
string(
  select(
    result('TRY'),
    json(concat(
      '{"step":"', item()?['name'],
      '","outcome":"', item()?['status'],
      '","at":"', item()?['endTime'], '"}'
    ))
  )
)
```

```ts
// lib/workflow/run-logger.ts — the same data, accumulated as the run proceeds
failed(step: WorkflowStep, detail: string, retries = 0): void {
  this.record(step, 'failed', detail)
  if (!this.failedStep) {
    this.failedStep = step
    this.errorMessage = detail
    this.retryCount = retries
  }
}
```

Both keep the **first** failure as the reported one. A later failure is usually
a consequence of the first, and reporting the last would point an operator at
the symptom instead of the cause.

---

**Related:** [`workflow.md`](workflow.md) · [`error-handling.md`](error-handling.md)
