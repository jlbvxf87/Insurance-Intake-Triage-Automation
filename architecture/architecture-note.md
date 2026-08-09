# Architecture Note — v0 (Phase 0)

Status: **initial**. Written before implementation so the build has something
to be measured against. Revised at the end of each phase; see the revision log
at the bottom.

---

## 1. What this system is

An intake and triage pipeline for insurance quote requests and claims. A
submitter fills a form and optionally attaches a policy document. The system
extracts structured data from that document, matches or creates a client
record, checks for duplicate submissions, applies deterministic routing rules,
assigns the submission to an internal team, notifies the submitter, and writes
an audit log for every run — successful or not.

The design constraint that shapes everything else:

> **AI proposes. Deterministic rules decide. Humans arbitrate.**

Document extraction is probabilistic, so it is never allowed to make the final
routing call on its own. Routing is a pure function of validated inputs. When
inputs are missing, low-confidence, or ambiguous, the submission is escalated
to a person rather than guessed at.

---

## 2. Two layers, one system

This repository contains a **working reference implementation** in
TypeScript, and **implementation documentation** for the Microsoft Power
Platform equivalent.

| Concern | Reference implementation (this repo) | Microsoft implementation (documented) |
|---|---|---|
| Intake UI | Next.js route + React form | Power Apps canvas app / Microsoft Forms |
| Data store | Typed in-memory repository seeded with synthetic records | Microsoft Dataverse tables |
| Orchestration | `lib/workflow` orchestrator, TRY/CATCH/FINALLY shaped | Power Automate cloud flow with Scope actions |
| Extraction | `lib/extraction` adapter → Azure REST or fixtures | Azure AI Document Intelligence connector |
| Ops UI | Next.js dashboard | Model-driven app views |
| Audit | `AutomationLog` records | `AutomationLog` Dataverse table |

The two layers share the same schema, the same field names, the same status
vocabulary, and the same business rules. `power-automate/` documents the
action-by-action mapping so the local logic is traceable to real Power
Automate steps rather than being a loose analogy.

Why build a reference implementation at all: a public portfolio artifact has to
be *runnable* by someone who has no access to a licensed Dataverse
environment. Every claim made on the case-study page should be executable by a
reader in under two minutes.

---

## 3. Runtime shape

```text
                       ┌──────────────────────────────┐
   Browser             │  app/intake                  │
   (public)            │  React form + client checks  │
                       └───────────────┬──────────────┘
                                       │  multipart POST
                                       │  (document never leaves the origin)
                       ┌───────────────▼──────────────┐
   Server              │  app/api/submissions         │
   (Node runtime)      │  server-side re-validation   │
                       └───────────────┬──────────────┘
                                       │
                       ┌───────────────▼──────────────┐
                       │  lib/workflow/orchestrator   │
                       │  TRY / CATCH / FINALLY       │
                       └──┬────┬────┬────┬────┬───┬───┘
                          │    │    │    │    │   │
        ┌─────────────────┘    │    │    │    │   └──────────────┐
        │            ┌─────────┘    │    │    └────────┐         │
        ▼            ▼              ▼    ▼             ▼         ▼
   client match  duplicate     extraction  business  routing   audit
   lib/data      lib/workflow  lib/extraction  rules  assign   log
                                    │
                            ┌───────┴────────┐
                            ▼                ▼
                    AzureAdapter      FixtureAdapter
                    (REST, server)    (deterministic)
```

Key boundaries:

- **The browser never talks to Azure.** Credentials live only in server
  environment variables. The document is posted to this application's own API
  route, which then calls Azure server-side.
- **The extraction adapter is an interface.** `AzureAdapter` and
  `FixtureAdapter` satisfy the same contract and return the same normalized
  shape. Switching between them is configuration, not code.
- **The orchestrator is pure with respect to I/O.** It receives a repository
  and an extractor by dependency injection, which is what makes the full
  failure matrix testable without network access or a live CRM.

---

## 4. Directory intent

```text
app/                Next.js routes: case study (/), intake, ops dashboard, API
components/         Presentational React components, grouped by surface
lib/domain/         Types, enums, Zod schemas — the shared vocabulary
lib/extraction/     Extraction adapter interface + Azure and fixture impls
lib/workflow/       Orchestrator, business rules, duplicate detection, logging
lib/data/           Repository interface + synthetic seed data
lib/utils/          Small shared helpers (normalization, formatting, ids)
tests/              Vitest suites, one per required test scenario
docs/               Business analysis: case, current/future state, requirements,
                    acceptance criteria, test plan
dataverse/          Table schema and relationship documentation
ai/                 Extraction prompt/model notes, output schema, validation rules
power-automate/     Flow design, expressions, error-handling documentation
sample-data/        Synthetic clients and submissions (CSV)
architecture/       This note and system diagrams
demo/               Screenshots and demo assets
```

---

## 5. Decisions made in Phase 0

**D-001 — Next.js App Router, TypeScript, Tailwind.**
Server-side API routes are required to keep Azure credentials off the client.
The App Router gives that in the same project as the case-study page, so the
portfolio site and the working demo are one deployable rather than two.

**D-002 — In-memory repository instead of a database.**
The demo must be reproducible from a clean clone with no external services and
no seeded database. The repository is defined as an interface, so a Dataverse
or SQL implementation can be added without touching the orchestrator. Data
resets on server restart; this is a demo property, stated plainly rather than
hidden.

**D-003 — Extraction behind an adapter, `auto` provider selection by default.**
The project must run for a reader with no Azure subscription, and must run
against real Azure for the author. `EXTRACTION_PROVIDER=auto` resolves to Azure
when an endpoint and key are present and to fixtures otherwise. The active mode
is surfaced in the UI so demo output is never mistaken for a live Azure call.

**D-004 — Zod for validation at both boundaries.**
The same schema validates the client form and the server request, so the two
cannot drift. Zod also validates the *response from Azure*, which is treated as
untrusted input rather than assumed well-formed.

**D-005 — Vitest for tests.**
The required scenarios are mostly pure-logic assertions against the
orchestrator. Vitest runs them without a browser, which keeps the suite fast
enough to run on every commit.

**D-006 — Self-hosted fonts via the `geist` package, not `next/font/google`.**
The production build initially failed because `next/font/google` fetches font
files from `fonts.googleapis.com` at build time, which fails in any sandboxed
or air-gapped build environment. Self-hosting removes a build-time network
dependency and a third-party request from every page load. Documented because
the failure is non-obvious and would recur for anyone building in CI without
egress.

**D-007 — Synthetic data only, generated in-repo.**
No real insurance data of any kind. Sample clients and submissions are
obviously fictional and are committed as CSV so a reviewer can read them
without running the app.

---

## 6. Open questions carried into later phases

| # | Question | Resolution |
|---|---|---|
| Q-1 | Which Document Intelligence model? | **`prebuilt-document`.** No training corpus required, works on the first document of any layout. The model id is configuration and the normalization layer already reads both response shapes, so a custom-trained ACORD model is a config change rather than a rewrite. `ai/extraction-model.md` §2. |
| Q-2 | Mean or minimum field confidence? | **Mean.** A single weak ancillary field should not send an otherwise clean extraction to review — the review queue is only useful while the things in it genuinely need a person. Bounded by the independent required-field check and by retaining per-field confidences. `ai/extraction-model.md` §5. |
| Q-3 | Duplicate window global or per line of business? | **Global.** One `DUPLICATE_WINDOW_DAYS` value. Per-line windows would be more precise, but the rule is one an operations lead has to be able to explain to a client whose submission was held, and "30 days" is explainable in a way that a table of five different windows is not. Revisit if a line shows a materially different re-submission pattern. |
| Q-4 | Do exceptions retry automatically? | **No.** Retries happen *inside* the extraction call (3 attempts, 5xx and 429 only). Once a run reaches `Exception`, an operator acts. A write failure may be a constraint violation, and re-running it produces the same violation while hiding the cause. `power-automate/error-handling.md` §4. |

---

## 7. Decisions made during implementation

**D-008 — Adapters return failures rather than throwing.**
Every extraction failure mode is returned as a typed `ExtractionFailure`. This
keeps outcome classification in one place — the orchestrator — instead of
splitting it between a return value and a catch block, and it makes the failure
taxonomy part of the type system rather than a convention.

**D-009 — State transitions declared as data and enforced.**
Without an explicit table, a bug in a review handler could move an `Exception`
straight to `Closed` and the audit trail would show a transition the design
never intended. Declaring them makes an invalid move an error where it is
attempted. Reversed nothing; added a guard that did not previously exist.

**D-010 — Business guards are separate from the transition table.**
Discovered by running the app: "confirm duplicate" succeeded on a submission
never flagged as one, because `Routed → Closed` is a legal transition. The
state machine governs *where* a record may go; it cannot know whether the
stated reason is true. Those are different questions and need different checks.

**D-011 — Id counters on `globalThis`.**
Also discovered by running the app. Next.js can instantiate the same module
across separate bundles, so a module-level counter produced ids that collided
with seeded records. In Dataverse this problem does not exist — Autonumber is
allocated by the platform — and the global is the equivalent guarantee for the
demo store.

---

## Revision log

| Version | Phase | Change |
|---|---|---|
| v0 | Phase 0 | Initial note. Structure, boundaries, and seven scaffold decisions recorded. |
| v1 | Phase 8 | All four open questions resolved with reasoning. Added D-008 through D-011 covering decisions taken during implementation. |
