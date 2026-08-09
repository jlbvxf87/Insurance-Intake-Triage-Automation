import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import type { QueueView } from '@/lib/data/metrics'

/**
 * Queue view selector (FR-035).
 *
 * Plain links with a query parameter rather than client-side state: each view
 * is a real URL an operator can bookmark or share, and the filtering happens
 * on the server. Rendered as a `nav` with `aria-current` so the active view is
 * announced rather than only shown.
 */
export function ViewTabs({
  views,
  activeId,
  counts,
}: {
  views: QueueView[]
  activeId: string
  counts: Record<string, number>
}) {
  return (
    <nav aria-label="Queue views" className="-mx-1 overflow-x-auto pb-px">
      <ul className="flex min-w-max gap-1 border-b border-[var(--border)] px-1">
        {views.map((view) => {
          const active = view.id === activeId
          const count = counts[view.id] ?? 0

          return (
            <li key={view.id}>
              <Link
                href={view.id === 'all' ? '/ops' : `/ops?view=${view.id}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'border-[var(--foreground)] font-medium text-[var(--foreground)]'
                    : 'border-transparent text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]',
                )}
              >
                {view.label}
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] tabular-nums',
                    active
                      ? 'bg-[var(--foreground)] text-white'
                      : 'bg-[var(--surface)] text-[var(--subtle)]',
                  )}
                >
                  {count}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
