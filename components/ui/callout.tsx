import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const tones: Record<
  Tone,
  { wrapper: string; icon: typeof Info; iconClass: string }
> = {
  info: {
    wrapper: 'border-[#d7e3f8] bg-[var(--accent-soft)] text-[#12457f]',
    icon: Info,
    iconClass: 'text-[var(--accent)]',
  },
  success: {
    wrapper: 'border-[#c9e7d1] bg-[#f1f9f3] text-[#11602a]',
    icon: CheckCircle2,
    iconClass: 'text-[var(--ok)]',
  },
  warning: {
    wrapper: 'border-[#eddfb5] bg-[#fdf8ec] text-[#6f4a06]',
    icon: AlertTriangle,
    iconClass: 'text-[var(--warn)]',
  },
  danger: {
    wrapper: 'border-[#f0cfcd] bg-[#fdf2f1] text-[#8a1c16]',
    icon: XCircle,
    iconClass: 'text-[var(--danger)]',
  },
}

export function Callout({
  tone = 'info',
  title,
  children,
  className,
  role,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
  className?: string
  role?: 'alert' | 'status'
}) {
  const { wrapper, icon: Icon, iconClass } = tones[tone]

  return (
    <div
      role={role}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', wrapper, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1')}>{children}</div>}
      </div>
    </div>
  )
}
