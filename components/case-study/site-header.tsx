'use client'

import Link from 'next/link'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Container } from './primitives'
import { SITE } from '@/lib/case-study/content'
import { cn } from '@/lib/utils/cn'

const NAV = [
  { label: 'System', href: '#system' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Testing', href: '#testing' },
] as const

const EXTERNAL = [
  { label: 'GitHub', href: SITE.github },
  { label: 'Resume', href: SITE.resume },
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
                className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
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
