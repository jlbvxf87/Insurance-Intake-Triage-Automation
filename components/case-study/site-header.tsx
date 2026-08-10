'use client'

import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Container } from './primitives'
import { SITE } from '@/lib/case-study/content'
import { cn } from '@/lib/utils/cn'

/** In-page section anchors. These scroll; they do not navigate. */
const NAV = [
  { label: 'Workflow', href: '#workflow' },
  { label: 'System', href: '#system' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Testing', href: '#testing' },
] as const

const EXTERNAL = [
  { label: 'GitHub', href: SITE.github },
  { label: 'Resume', href: SITE.resume },
] as const

/**
 * The running application, as opposed to the case study describing it.
 *
 * These are separate pages, and the header previously offered no route to
 * either — a reader could finish the entire case study without discovering
 * that the thing it describes is live and clickable. Anchors and page
 * navigation are kept visually distinct because they behave differently:
 * one scrolls, the other leaves the page.
 */
const APP = [
  { label: 'Dashboard', href: '/ops' },
  { label: 'Try it live', href: '/intake' },
] as const

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/85 backdrop-blur-md">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]"
          >
            {SITE.author}
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                {item.label}
              </a>
            ))}
            {EXTERNAL.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}

            <span
              aria-hidden="true"
              className="mx-1 h-5 w-px bg-[var(--border)]"
            />

            <Link
              href="/ops"
              className="rounded-md px-2.5 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface)]"
            >
              Dashboard
            </Link>
            <Link
              href="/intake"
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#242424]"
            >
              Try it live
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </nav>

          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] md:hidden"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </Container>

      <div
        id="mobile-nav"
        className={cn(
          'border-t border-[var(--border)] bg-white md:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <Container>
          <nav aria-label="Primary, mobile" className="flex flex-col py-2">
            {/* The live application first: it is the thing worth reaching. */}
            <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-3">
              {APP.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'inline-flex h-10 items-center justify-between rounded-lg px-3 text-sm font-medium',
                    item.href === '/intake'
                      ? 'bg-[var(--foreground)] text-white'
                      : 'border border-[var(--border-strong)] text-[var(--foreground)]',
                  )}
                >
                  {item.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ))}
            </div>

            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-1 py-2.5 text-sm text-[var(--muted)]"
              >
                {item.label}
              </a>
            ))}
            {EXTERNAL.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 px-1 py-2.5 text-sm text-[var(--muted)]"
              >
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </Container>
      </div>
    </header>
  )
}
