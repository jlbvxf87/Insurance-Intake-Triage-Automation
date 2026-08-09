import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Layout primitives for the case study.
 *
 * One max-width, one horizontal rhythm, one vertical rhythm. Sections declare
 * intent (`Section`, `SectionHeader`, `Card`) rather than repeating spacing
 * classes, which is what keeps the page from drifting as it grows to eighteen
 * sections.
 */

export function Container({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1180px] px-5 sm:px-8', className)}>
      {children}
    </div>
  )
}

export function Section({
  id,
  children,
  className,
  tone = 'light',
  spacing = 'default',
}: {
  id?: string
  children: ReactNode
  className?: string
  tone?: 'light' | 'plain' | 'dark'
  spacing?: 'default' | 'tight'
}) {
  return (
    <section
      id={id}
      // scroll-mt keeps an anchored heading clear of the sticky header.
      className={cn(
        'scroll-mt-20',
        spacing === 'tight' ? 'py-10 sm:py-12' : 'py-14 sm:py-20',
        tone === 'light' && 'bg-[var(--page)]',
        tone === 'plain' && 'bg-white',
        tone === 'dark' && 'bg-[var(--ink)] text-[var(--ink-foreground)]',
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  )
}

export function Eyebrow({
  children,
  dark,
}: {
  children: ReactNode
  dark?: boolean
}) {
  return (
    <p
      className={cn(
        'font-mono text-[11px] font-medium tracking-[0.14em] uppercase',
        dark ? 'text-[var(--ink-muted)]' : 'text-[var(--subtle)]',
      )}
    >
      {children}
    </p>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  lede,
  dark,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: string
  lede?: ReactNode
  dark?: boolean
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      {eyebrow && <Eyebrow dark={dark}>{eyebrow}</Eyebrow>}
      <h2
        className={cn(
          'text-2xl font-semibold tracking-tight text-balance sm:text-[32px] sm:leading-[1.15]',
          dark ? 'text-white' : 'text-[var(--foreground)]',
        )}
      >
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            'max-w-2xl leading-relaxed text-pretty',
            align === 'center' && 'mx-auto',
            dark ? 'text-[var(--ink-muted)]' : 'text-[var(--muted)]',
          )}
        >
          {lede}
        </p>
      )}
    </header>
  )
}

export function Card({
  children,
  className,
  as: Tag = 'div',
  interactive = false,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li' | 'article'
  interactive?: boolean
}) {
  return (
    <Tag
      className={cn(
        'rounded-[14px] border border-[var(--border)] bg-white',
        interactive && 'transition-colors duration-150 hover:border-[var(--border-strong)]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function DarkCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-[var(--ink-border)] bg-[var(--ink-soft)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Small caps label used above dense data blocks. */
export function MicroLabel({
  children,
  dark,
  className,
}: {
  children: ReactNode
  dark?: boolean
  className?: string
}) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold tracking-[0.08em] uppercase',
        dark ? 'text-[var(--ink-muted)]' : 'text-[var(--subtle)]',
        className,
      )}
    >
      {children}
    </p>
  )
}
