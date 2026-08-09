# Insurance Intake & Triage Automation

An AI-enabled insurance workflow that turns incoming submissions and policy
documents into structured, validated, routed records.

**Azure AI · Dataverse · Power Automate · REST APIs**

> A self-directed case study. This project is not work performed for any
> insurer or broker, and contains no real customer data — every client,
> submission, and document in this repository is synthetic.

---

## Status

| Phase | Deliverable | State |
|---|---|---|
| 0 | Repository + project scaffold | ✅ Complete |
| 1 | Business analysis documentation | ✅ Complete |
| 2 | Data model | ⬜ Not started |
| 3 | Digital intake | ⬜ Not started |
| 4 | Azure AI Document Intelligence | ⬜ Not started |
| 5 | Workflow / automation logic | ⬜ Not started |
| 6 | Error handling + human review | ⬜ Not started |
| 7 | Operations dashboard | ⬜ Not started |
| 8 | Testing + documentation | ⬜ Not started |
| 9 | Portfolio case-study page | ⬜ Not started |
| 10 | Walkthrough video | ⬜ Not started |

This table is updated at the end of each phase. Nothing is marked complete
before it runs.

---

## 1. The problem

Insurance intake is, in most organizations, a person reading an email. That
person opens an attachment, reads a declarations page or ACORD form, searches
the CRM for the client, decides whether this is something they have already
seen, retypes the policy details into a record, works out which team owns the
line of business, forwards it, and sends an acknowledgement.

Every step in that list is either mechanical or a judgement call. The
mechanical ones are slow, inconsistent between operators, and get slower as
volume rises. The judgement calls are the part that actually needs a person.

## 2. What the system does

Separates the two.

```text
Digital intake
      ↓
Automated validation
      ↓
AI document extraction          ← probabilistic, never final
      ↓
Client match / create
      ↓
Duplicate detection
      ↓
Deterministic business rules    ← the routing decision
      ↓
Team assignment + confirmation
      ↓
Audit log + operations dashboard
      ↓
Human review for anything uncertain
```

The governing rule: **AI proposes, deterministic rules decide, humans
arbitrate.** Low-confidence extraction, possible duplicates, missing required
data, and unknown routing rules all escalate to a person instead of being
resolved by a guess.

## 3. Why it was built

To demonstrate, end to end, how a business applications problem gets handled:
map the current process, define the data model, write the business rules,
integrate the AI where it earns its place, automate the repeatable steps, build
the exception paths, and document requirements, acceptance criteria, and test
cases so the result can be maintained by someone else.

---

## 4. Repository layout

```text
app/                Next.js routes — case study, intake, ops dashboard, API
components/         React components grouped by surface
lib/domain/         Types, enums, and Zod schemas — the shared vocabulary
lib/extraction/     Extraction adapter interface, Azure and fixture impls
lib/workflow/       Orchestrator, business rules, duplicate detection, logging
lib/data/           Repository interface and synthetic seed data
lib/utils/          Shared helpers
tests/              Vitest suites — one per required test scenario
docs/               Business case, current/future state, requirements,
                    acceptance criteria, test plan
dataverse/          Table schema and relationship documentation
ai/                 Extraction model notes, output schema, validation rules
power-automate/     Flow design, expressions, error-handling documentation
sample-data/        Synthetic clients and submissions (CSV)
architecture/       Architecture note and system diagrams
demo/               Screenshots and demo assets
```

Sections on the architecture, data model, workflow, AI integration, business
rules, error handling, testing, screenshots, and live demo are added as the
phases that produce them complete. See
[`architecture/architecture-note.md`](architecture/architecture-note.md) for
the current design and the decision log.

---

## 5. Local setup

Requires Node 20 or newer.

```bash
git clone https://github.com/jlbvxf87/Insurance-Intake-Triage-Automation.git
cd Insurance-Intake-Triage-Automation
npm install
cp .env.example .env.local
npm run dev
```

The app runs at `http://localhost:3000`. With no Azure credentials configured
it starts in **fixture mode** — document extraction returns deterministic local
fixtures instead of calling Azure, and the UI says so.

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |

## 6. Environment variables

All configuration is server-side. No variable is prefixed `NEXT_PUBLIC_`, so
no credential is ever bundled into client JavaScript. See
[`.env.example`](.env.example) for the annotated template.

| Variable | Purpose | Default |
|---|---|---|
| `EXTRACTION_PROVIDER` | `auto` \| `azure` \| `fixture` | `auto` |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Azure resource endpoint | — |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Azure resource key | — |
| `AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID` | Model used to analyze | `prebuilt-document` |
| `EXTRACTION_CONFIDENCE_THRESHOLD` | Below this, human review | `0.80` |
| `DUPLICATE_WINDOW_DAYS` | Duplicate detection window | `30` |
| `MAX_UPLOAD_MB` | Upload size limit | `10` |

`.env` and `.env.local` are gitignored. Credentials are never committed.

---

## 7. Data handling

- All data in this repository is synthetic and generated for the case study.
- Uploaded documents are processed in memory and are not committed.
- The public demo writes to an in-memory store that resets when the server
  restarts. It does not connect to a live CRM.

---

## License

MIT — see [`LICENSE`](LICENSE).
