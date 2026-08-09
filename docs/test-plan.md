# Test Plan

**Version:** 2.0 — Phase 8
**Last executed:** 9 August 2026
**Result:** 188 automated tests, 188 passing, 0 failing.

All statuses below are transcribed from recorded output. No case was marked
`PASS` before it was implemented and observed to pass.

---

## 1. Status legend

| Status | Meaning |
|---|---|
| `PASS` | Implemented, executed, observed to pass |
| `FAIL` | Implemented, executed, observed to fail |
| `MANUAL` | Verified by hand against a running server; not automated |
| `NOT RUN` | Not yet implemented or executed |
| `BLOCKED` | Cannot execute — dependency unavailable |

## 2. Recorded results

```text
$ npm run typecheck     tsc --noEmit                      no errors
$ npm run lint          eslint                            no errors, no warnings
$ npm run build         next build                        succeeded
$ npm test              vitest run                        188 passed (188)

 tests/domain.test.ts              48 passed
 tests/extraction.test.ts          44 passed
 tests/metrics.test.ts             19 passed
 tests/repository-hygiene.test.ts   4 passed
 tests/review.test.ts              20 passed
 tests/workflow.test.ts            53 passed
```

## 3. Approach

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | Business rules, duplicate detection, normalization, coercion, metrics — pure functions, no I/O |
| Integration | Vitest with injected fakes | Full orchestrator runs against an in-memory repository and a stub extraction adapter |
| Contract | Vitest with an injected `fetch` | Azure request shape, polling, retry policy, timeout, and malformed-response handling |
| Static | `tsc --noEmit`, ESLint | Type safety, lint rules |
| Hygiene | Vitest | No committed secrets, no `NEXT_PUBLIC_` credential |
| Manual | curl + browser | HTTP status codes, rendering, accessibility, responsive behaviour |

Failure paths are exercised by **injecting failures**, never by disabling code:

- `FailingExtractionAdapter` returns a chosen failure kind.
- `FailingRepository` throws on a chosen operation.
- The Azure adapter takes an injected `fetch`, so 503, 429, 400, timeout, and
  malformed-response paths run without a network.
- The orchestrator takes an injected clock, so duplicate-window boundaries are
  exact rather than approximate.

A test that passes because the failing branch was removed proves nothing.

## 4. Test data

Synthetic, defined in `lib/data/seed.ts` and exported to `sample-data/`.

| Fixture | Purpose |
|---|---|
| `CLI-1001` ACME Trucking LLC | Existing client with prior Commercial Auto quotes — match and duplicate cases |
| `CLI-1003` Belmont Fabrication Co | Existing client, Workers Compensation |
| `CLI-1006` Kestrel Benefit Partners | Prior General Liability quote ~13 days old — duplicate window boundary |
| `high-confidence` | All required fields, aggregate 0.94 |
| `low-confidence` | All required fields, aggregate 0.62 |
| `missing-field` | Aggregate 0.84, no policy number |
| `boundary` | Aggregate exactly 0.80 |
| `trigger-timeout` / `trigger-error` / `trigger-malformed` | Failure paths |

## 5. Test cases

### Core path

| ID | Scenario | Expected result | AC | Status |
|---|---|---|---|---|
| TC-01 | Valid quote submission | Status `Routed`; team assigned by rule; `needsHumanReview` false; log `Succeeded`; reference returned | AC-001 | `PASS` |
| TC-02 | Existing client match | Links to `CLI-1001` despite casing and whitespace; client count unchanged; existing record unmodified | AC-002 | `PASS` |
| TC-03 | New client creation | Client created and linked with a normalized email; submission routes normally | AC-003 | `PASS` |
| TC-10 | Deterministic routing | All five lines of business map to the documented team; identical on repeat; end-to-end per line | AC-010 | `PASS` |
| TC-11 | Submitter confirmation | Acknowledgement carries the reference and assigned team; recorded on the run | AC-011 | `PASS` |
| TC-12 | Automation log created | Exactly one log per run on every path; run id, timestamps, duration, and full step trace | AC-012 | `PASS` |

### Exception path

| ID | Scenario | Expected result | AC | Status |
|---|---|---|---|---|
| TC-04 | Duplicate detection | `duplicateFlag` true; reason names every matched condition and the window; status `Duplicate`; never rejected or closed | AC-004 | `PASS` |
| TC-04b | Outside the duplicate window | Same submission flags at a 30-day window and clears at a 5-day one | AC-004 | `PASS` |
| TC-04c | Prior submission in `Exception` | Not treated as duplicate evidence (BR-015) | AC-004 | `PASS` |
| TC-04d | Several matches | The most recent prior submission is referenced | AC-004 | `PASS` |
| TC-05 | Missing document | Extraction skipped and *recorded as skipped*; no extraction record; status `Routed` | AC-005 | `PASS` |
| TC-06 | Low AI confidence | Values retained; `Unverified`; `needsHumanReview`; status `In Review`; per-field confidence retained | AC-006 | `PASS` |
| TC-06b | Confidence exactly at threshold | `Validated` and routed — threshold is inclusive | AC-006 | `PASS` |
| TC-06c | Raised threshold | A 0.93 extraction routes to review at a 0.99 threshold, with no code change | BR-017 | `PASS` |
| TC-07 | Unsupported file type / oversize | HTTP 400 with a field-level reason naming type or size; no records created | AC-007 | `PASS` |
| TC-08 | Azure service error | Status `Exception`; log `Failed` with `stepFailed` and message; submission preserved | AC-008 | `PASS` |
| TC-08b | Azure timeout | Aborted request converted to a logged timeout; status `Exception` | AC-008 | `PASS` |
| TC-08c | Malformed Azure response | Treated as failure, not data; status `Exception` | AC-008 | `PASS` |
| TC-08d | Retry policy | 503 and 429 retried up to 3 attempts; 400 not retried | §4 error-handling | `PASS` |
| TC-09 | Missing routing rule | `General Intake`; `needsHumanReview`; status `In Review`; reason recorded | AC-009 | `PASS` |
| TC-13 | Missing required extracted field | `Failed` validation; missing field named; status `In Review`; extracted values retained | AC-013 | `PASS` |
| TC-14 | Record write failure | Status `Exception`; failure logged; no unhandled exception; nothing left in `Processing` | AC-014 | `PASS` |
| TC-15 | Duplicate *and* low confidence | Status `Duplicate` by precedence; both reasons recorded | AC-015 | `PASS` |

### Validation

| ID | Scenario | Expected result | Status |
|---|---|---|---|
| TC-18 | Missing required form field | Rejected on the client and again on the server; field-level errors | `PASS` |
| TC-19 | Malformed email | Rejected with a field-level error | `PASS` |
| TC-20 | Description over maximum length | Rejected with a field-level error | `PASS` |
| TC-21 | Email normalization | Casing and whitespace variants normalize to one key; plus-addressing preserved | `PASS` |
| TC-29 | Currency coercion | US and European separator conventions, symbols, and unparseable input | `PASS` |
| TC-30 | Date coercion | ISO, US, two-digit-year, and long-form; unparseable → null | `PASS` |
| TC-31 | Policy type mapping | Option set, free-text variants, and `Unknown` fallback | `PASS` |
| TC-32 | Azure response schema | Unknown properties ignored; load-bearing structure enforced | `PASS` |

### Human review

| ID | Scenario | Expected result | Status |
|---|---|---|---|
| TC-33 | State machine | Every status has a declared transition list; `Closed` is terminal | `PASS` |
| TC-34 | Release | Applies routing, clears flags, notifies the submitter, logs the actor | `PASS` |
| TC-35 | Correct extraction | Values updated and `Validated`; **status unchanged**; model confidence preserved | `PASS` |
| TC-36 | Dismiss duplicate | Flag and reason cleared; routed | `PASS` |
| TC-37 | Confirm duplicate | Closed; duplicate reason retained | `PASS` |
| TC-38 | Invalid transition | Rejected with a message naming the allowed targets | `PASS` |
| TC-39 | Action guards | Duplicate actions refused on a submission never flagged as one | `PASS` |
| TC-40 | Identifier allocation | Runtime ids never collide with seeded ids | `PASS` |

### Non-functional

| ID | Scenario | Method | Result | Status |
|---|---|---|---|---|
| TC-16 | No committed secrets | Automated | No tracked `.env`; `.env.example` values empty; no `NEXT_PUBLIC_` variable | `PASS` |
| TC-17 | Dashboard reflects state | Automated | Every view count equals its filter; KPIs agree with the records; health buckets sum to the total | `PASS` |
| TC-22 | Type safety | `tsc --noEmit` | No errors | `PASS` |
| TC-23 | Production build | `npm run build` | Succeeded | `PASS` |
| TC-24 | Lint | `npm run lint` | No errors, no warnings | `PASS` |
| TC-25 | API status codes | Manual (curl) | 201 accepted · 400 invalid · 404 unknown · 409 disallowed transition · 200 applied | `MANUAL` |
| TC-26 | End-to-end intake | Manual (curl) | Routed, duplicate, low-confidence, exception, and rejection paths all produced the documented outcome against a running server | `MANUAL` |
| TC-27 | Responsive layout | Manual (screenshots at 390 px and 1440 px) | Usable at both; no horizontal scrolling; table becomes a card list below `md` | `MANUAL` |
| TC-28 | Status not conveyed by colour alone | Manual | Every status badge carries a text label alongside its dot | `MANUAL` |

## 6. Coverage against the required scenarios

| Required scenario | Test case | Status |
|---|---|---|
| Valid quote | TC-01 | `PASS` |
| Existing client | TC-02 | `PASS` |
| New client | TC-03 | `PASS` |
| Duplicate | TC-04, TC-04b, TC-04c, TC-04d | `PASS` |
| Missing document | TC-05 | `PASS` |
| Low confidence | TC-06, TC-06b, TC-06c | `PASS` |
| Unsupported file | TC-07 | `PASS` |
| Azure error | TC-08, TC-08b, TC-08c, TC-08d | `PASS` |
| Missing routing rule | TC-09 | `PASS` |
| Successful routing | TC-10 | `PASS` |
| Customer confirmation | TC-11 | `PASS` |
| Log creation | TC-12 | `PASS` |

All twelve covered by automated tests.

## 7. Defects found by testing

Recorded because "the tests pass" is only meaningful if the tests ever failed.

| # | Defect | Found by | Fix |
|---|---|---|---|
| D-1 | `parseCurrency('$1,000,000')` returned `null`. The "last separator is the decimal point" heuristic turned three grouping commas into `1.000,000` → `NaN`, so a coverage amount silently disappeared from every US-formatted document. | TC-29 | Rewrote the rules ordered from most to least certain: repeated separators are grouping; both present means the last is decimal; a single comma is decimal only if ≤2 digits follow. |
| D-2 | `parsePolicyType('Excess Liability')` returned `General Liability`. The bare `liability` pattern matched before the umbrella check, mislabelling every excess policy. | TC-31 | Reordered so `umbrella\|excess` is tested before the liability fallback, with a comment recording why the order is load-bearing. |
| D-3 | Id counters lived in a module-level object. Next.js can instantiate the same module across separate bundles, so a review action wrote `LOG-10001` while the seed had reserved `LOG-30xxx` — a collision. | Running the app | Counters moved to `globalThis`, matching how the repository is already held. TC-40 added. |
| D-4 | "Confirm duplicate" succeeded on a submission never flagged as one, because `Routed → Closed` is a legal transition. The resulting log entry would have asserted a false reason for closure. | Running the app | Added a guard separate from the state machine: the transition table governs where a record may go, not whether the stated reason is true. TC-39 added. |
| D-5 | A `return` inside `finally` in the orchestrator would have swallowed any exception still propagating. | ESLint | Restructured so `finally` assigns and the function returns after it. |

D-1 and D-2 are the two worth noting: both were silent. Neither threw, neither
logged, and both produced a plausible-looking wrong answer — exactly the class
of defect this project's confidence gates and audit trail exist to catch, and
exactly the class that reading the code would not have surfaced.

## 8. Known gaps

Stated rather than hidden:

- **No live Azure verification.** The Azure adapter is tested against an
  injected `fetch` covering success, polling, retry, timeout, and malformed
  responses. It has **not** been run against a real Document Intelligence
  resource. Doing so requires credentials and is the first thing to verify when
  they are available.
- **No browser-automated accessibility audit.** Keyboard operation, focus
  order, and reduced motion were built to spec and checked by hand. An
  automated axe-core pass would be stronger.
- **No load or concurrency testing.** The in-memory store is single-process by
  design; concurrency behaviour would be a property of Dataverse, not of this
  code.
- **Log-store failure is unrecoverable.** If the automation log store itself is
  unavailable, nothing further can be recorded through it. Documented in
  `power-automate/error-handling.md` §3, row 17.

## 9. Exit criteria

| Criterion | Status |
|---|---|
| Every case `PASS` or with a documented reason | ✅ |
| `npm test` succeeds | ✅ 188/188 |
| `npm run typecheck` succeeds | ✅ |
| `npm run build` succeeds | ✅ |
| `npm run lint` succeeds | ✅ |
| Results transcribed from real output | ✅ |
| Failures fixed or recorded as known limitations | ✅ §7, §8 |

## 10. Results log

| Date | Command | Result |
|---|---|---|
| 9 Aug 2026 | `npm test` | 188 passed, 0 failed |
| 9 Aug 2026 | `npm run typecheck` | No errors |
| 9 Aug 2026 | `npm run lint` | No errors, no warnings |
| 9 Aug 2026 | `npm run build` | Succeeded |
| 9 Aug 2026 | Manual API sweep (curl) | 201 / 400 / 404 / 409 / 200 as documented |
| 9 Aug 2026 | Screenshot capture at 1440 px and 390 px | 10 screenshots, `demo/screenshots/` |

---

**Related:** [`acceptance-criteria.md`](acceptance-criteria.md) · [`requirements.md`](requirements.md) · [`../power-automate/error-handling.md`](../power-automate/error-handling.md)
