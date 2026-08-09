import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { IntakeForm } from '@/components/intake/intake-form'
import { Callout } from '@/components/ui/callout'
import { getConfig, toPublicConfig } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Submit a request · Insurance Intake & Triage',
  description:
    'Submit an insurance quote request or claim with a supporting policy document.',
}

export const dynamic = 'force-dynamic'

export default function IntakePage() {
  // Read server-side and pass only the public projection to the client.
  const config = toPublicConfig(getConfig())

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to case study
      </Link>

      <header className="mt-8">
        <p className="font-mono text-xs tracking-widest text-[var(--subtle)] uppercase">
          Digital intake
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Submit a quote request or claim
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-[var(--muted)] text-pretty">
          The details below are validated, matched against existing client
          records, checked for duplicates, and routed by line of business. If
          you attach a document, its policy fields are extracted and validated
          before the request is routed.
        </p>
      </header>

      <div className="mt-8">
        {config.isDemoMode ? (
          <Callout tone="info" title="Demo mode">
            No Azure credentials are configured, so document extraction returns
            deterministic local fixtures rather than calling Azure AI Document
            Intelligence. Everything else — validation, client matching,
            duplicate detection, routing, and logging — runs exactly as it does
            in production. Records reset when the server restarts.
          </Callout>
        ) : (
          <Callout tone="info" title="Live extraction">
            Uploaded documents are analyzed by Azure AI Document Intelligence.
            Use synthetic documents only.
          </Callout>
        )}
      </div>

      <section className="mt-10">
        <IntakeForm config={config} />
      </section>

      <footer className="mt-16 border-t border-[var(--border)] pt-6 text-[13px] leading-relaxed text-[var(--subtle)]">
        <p>
          Documents are posted to this application and processed server-side.
          The browser never sends a file to Azure or any third party. Uploaded
          bytes are held in memory for the duration of the request and are not
          persisted.
        </p>
      </footer>
    </main>
  )
}
