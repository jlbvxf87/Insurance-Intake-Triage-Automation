/**
 * Phase 0 placeholder.
 *
 * The case-study landing page is built in Phase 9. Until then this route
 * states what exists and what does not, so the running app never implies
 * capability it has not yet been given.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-24">
      <p className="font-mono text-xs tracking-widest text-[var(--subtle)] uppercase">
        Phase 0 · Scaffold
      </p>

      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Insurance Intake &amp; Triage Automation
      </h1>

      <p className="mt-5 text-lg leading-relaxed text-[var(--muted)] text-pretty">
        An AI-enabled insurance workflow that turns incoming submissions and
        policy documents into structured, validated, routed records.
      </p>

      <p className="mt-6 font-mono text-sm text-[var(--subtle)]">
        Azure AI · Dataverse · Power Automate · REST APIs
      </p>

      <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold">Build status</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          The repository scaffold is in place. The intake experience,
          extraction layer, workflow engine, operations dashboard, and
          case-study page are delivered in later phases. Nothing on this page
          is a live system yet.
        </p>
      </div>
    </main>
  )
}
