# Test Plan

**Version:** 1.0 — Phase 1
**Last executed:** *not yet executed — the implementation is delivered in
Phases 3–7 and the suite in Phase 8.*

---

## 1. Status legend

| Status | Meaning |
|---|---|
| `NOT RUN` | Test not yet implemented or not yet executed |
| `PASS` | Implemented, executed, and observed to pass |
| `FAIL` | Implemented, executed, and observed to fail |
| `BLOCKED` | Cannot execute — dependency unavailable |

**Rule for this project:** a case is marked `PASS` only after it has been
implemented and observed to pass in an actual run. This table is updated from
recorded test output in Phase 8, never in advance.

## 2. Approach

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | Business rules, duplicate detection, normalization, extraction validation — pure functions, no I/O |
| Integration | Vitest with injected fakes | Full orchestrator runs against an in-memory repository and a stub extraction adapter |
| Contract | Vitest | Azure response normalization against captured/synthetic payloads, including malformed ones |
| Static | `tsc --noEmit`, ESLint | Type safety, lint rules |
| Hygiene | Vitest | No committed secrets, no `NEXT_PUBLIC_` credential |
| Manual | Browser | Accessibility, responsive behaviour, reduced motion, keyboard operation |

Failure paths are exercised by **injecting failures into the adapter and
repository**, not by disabling code. A test that passes because the failing
branch was removed proves nothing.

## 3. Test data

All synthetic, defined in `sample-data/` and `lib/data/`.

| Fixture | Purpose |
|---|---|
| `CLI-1001` ACME Trucking LLC | Existing client with prior submissions — used for match and duplicate cases |
| `CLI-1002` Northside Property Group | Existing client, Property line |
| `CLI-1003` Belmont Fabrication Co | Existing client, Workers Compensation line |
| *(new email)* | Unknown client — used for creation cases |
| `high-confidence` extraction | All required fields, aggregate ≈ 0.94 |
| `low-confidence` extraction | All required fields, aggregate ≈ 0.62 |
| `missing-field` extraction | Acceptable confidence, required field absent |
| `malformed` payload | Response that fails schema validation |
| `boundary` extraction | Aggregate confidence exactly at the threshold |

## 4. Test cases

### Core path

| ID | Scenario | Precondition | Steps | Expected result | AC | Status |
|---|---|---|---|---|---|---|
| TC-01 | Valid quote submission | Clean state | Submit a complete valid quote with a high-confidence document | Status `Routed`; team assigned per line of business; `needsHumanReview = false`; log status `Succeeded` | AC-001 | `NOT RUN` |
| TC-02 | Existing client match | `CLI-1001` exists | Submit using the same email with different casing and surrounding whitespace | Submission links to `CLI-1001`; client count unchanged | AC-002 | `NOT RUN` |
| TC-03 | New client creation | Email not present | Submit with an unknown email | New client created and linked; submission routes normally | AC-003 | `NOT RUN` |
| TC-10 | Deterministic routing | — | Apply rules to each of the five lines of business, twice | Auto / Property / Casualty / WC / General Intake; identical on repeat evaluation | AC-010 | `NOT RUN` |
| TC-11 | Submitter confirmation | — | Complete a submission that reaches `Routed` | Confirmation event emitted with reference and assigned team; recorded on the run | AC-011 | `NOT RUN` |
| TC-12 | Automation log created | — | Run the workflow to each terminal state | A log entry exists for every run, with run id, timestamps, and terminal status | AC-012 | `NOT RUN` |

### Exception path

| ID | Scenario | Precondition | Steps | Expected result | AC | Status |
|---|---|---|---|---|---|---|
| TC-04 | Duplicate detection | Prior matching submission 5 days old | Submit same client, type, and line of business | `duplicateFlag = true`; reason populated; `needsHumanReview = true`; status `Duplicate` | AC-004 | `NOT RUN` |
| TC-04b | Outside duplicate window | Prior matching submission 45 days old | Same submission | `duplicateFlag = false`; routes normally | AC-004 | `NOT RUN` |
| TC-04c | Prior submission in Exception | Prior matching submission in `Exception` | Same submission | Not treated as a duplicate (BR-015) | AC-004 | `NOT RUN` |
| TC-05 | Missing document | — | Submit with no attachment | Extraction skipped; no `ExtractedPolicyData`; status `Routed`; skip recorded in the log | AC-005 | `NOT RUN` |
| TC-06 | Low AI confidence | Threshold 0.80 | Process a document extracting at 0.62 | Values retained; `validationStatus = Unverified`; `needsHumanReview = true`; status `In Review` | AC-006 | `NOT RUN` |
| TC-06b | Confidence exactly at threshold | Threshold 0.80 | Process a document extracting at exactly 0.80 | `Validated`; routed — threshold is inclusive | AC-006 | `NOT RUN` |
| TC-07 | Unsupported file type | — | Attach a `.exe`; also attach an oversize PDF | HTTP 400 with a field-level reason naming type or size; no records created | AC-007 | `NOT RUN` |
| TC-08 | Azure extraction error | Adapter stubbed to throw | Submit with a document | Status `Exception`; log `Failed` with failing step and message; submission preserved | AC-008 | `NOT RUN` |
| TC-08b | Azure timeout | Adapter stubbed to exceed the timeout | Submit with a document | Timeout converted to a logged extraction failure; status `Exception` | AC-008 | `NOT RUN` |
| TC-08c | Malformed Azure response | Adapter returns a schema-invalid payload | Submit with a document | Treated as a failure, not as data; status `Exception` | AC-008 | `NOT RUN` |
| TC-09 | Missing routing rule | — | Submit an unrecognized line of business | `General Intake`; `needsHumanReview = true`; status `In Review`; reason recorded | AC-009 | `NOT RUN` |
| TC-13 | Missing required extracted field | Acceptable confidence | Process a document with no policy number | `validationStatus = Failed`; status `In Review` (Intake Correction); missing field named | AC-013 | `NOT RUN` |
| TC-14 | Record write failure | Repository stubbed to throw | Submit a valid submission | Status `Exception`; failure logged; no unhandled exception; nothing left in `Processing` | AC-014 | `NOT RUN` |
| TC-15 | Duplicate *and* low confidence | Prior matching submission; low-confidence document | Submit | Status `Duplicate` by precedence; both reasons recorded; `needsHumanReview = true` | AC-015 | `NOT RUN` |

### Validation

| ID | Scenario | Expected result | AC | Status |
|---|---|---|---|---|
| TC-18 | Missing required form field | Rejected on the client and again on the server; field-level errors; no record created | AC-001 | `NOT RUN` |
| TC-19 | Malformed email | Rejected with a field-level error | AC-001 | `NOT RUN` |
| TC-20 | Description exceeds maximum length | Rejected with a field-level error | AC-001 | `NOT RUN` |
| TC-21 | Email normalization | Casing and whitespace variants normalize to one key | AC-002 | `NOT RUN` |

### Non-functional

| ID | Scenario | Method | Expected result | AC | Status |
|---|---|---|---|---|---|
| TC-16 | No committed secrets | Automated | No tracked `.env`; `.env.example` values empty; no `NEXT_PUBLIC_` credential | AC-016 | `NOT RUN` |
| TC-17 | Dashboard reflects state | Automated + manual | Counters agree with underlying records; every view filters correctly | AC-017 | `NOT RUN` |
| TC-22 | Type safety | `tsc --noEmit` | No TypeScript errors | NFR-015 | `NOT RUN` |
| TC-23 | Production build | `npm run build` | Build succeeds | NFR-015 | `NOT RUN` |
| TC-24 | Clean-clone startup | Manual | App builds and runs with no external service configured; fixture mode indicated in UI | NFR-017 | `NOT RUN` |
| TC-25 | Keyboard operation | Manual | Intake and dashboard fully operable by keyboard with a visible focus indicator | NFR-010 | `NOT RUN` |
| TC-26 | Reduced motion | Manual | With `prefers-reduced-motion: reduce`, animation is suppressed and content remains complete | NFR-012 | `NOT RUN` |
| TC-27 | Responsive layout | Manual | Usable 360 px–1920 px with no horizontal scrolling | NFR-013 | `NOT RUN` |
| TC-28 | Status not conveyed by colour alone | Manual | Every status badge carries a text label | NFR-011 | `NOT RUN` |

## 5. Coverage against required scenarios

The twelve scenarios required by the project brief, and where each is covered:

| Required scenario | Test case |
|---|---|
| Valid quote | TC-01 |
| Existing client | TC-02 |
| New client | TC-03 |
| Duplicate | TC-04, TC-04b, TC-04c |
| Missing document | TC-05 |
| Low confidence | TC-06, TC-06b |
| Unsupported file | TC-07 |
| Azure error | TC-08, TC-08b, TC-08c |
| Missing routing rule | TC-09 |
| Successful routing | TC-10 |
| Customer confirmation | TC-11 |
| Log creation | TC-12 |

## 6. Exit criteria

Phase 8 closes only when:

- every case above is `PASS` or has a documented, accepted reason for another status,
- `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all succeed,
- the results in this document are transcribed from real recorded output,
- and any `FAIL` is either fixed or recorded as a known limitation in the README.

## 7. Results log

| Date | Command | Result | Notes |
|---|---|---|---|
| — | — | — | No test execution recorded yet. Suite is delivered in Phase 8. |

---

**Related:** [`acceptance-criteria.md`](acceptance-criteria.md) · [`requirements.md`](requirements.md)
