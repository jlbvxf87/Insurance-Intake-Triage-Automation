import {
  AlertCircle,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  FileText,
  Globe,
  Mail,
  Scale,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Upload,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Icon registry.
 *
 * Content in `lib/case-study/content.ts` refers to icons by name so the copy
 * stays free of component imports. The map is the single place a name becomes
 * a component.
 */
export const ICONS = {
  alert: AlertCircle,
  brain: Brain,
  chart: BarChart3,
  check: CheckCircle2,
  clipboard: ClipboardCheck,
  copy: Copy,
  database: Database,
  file: FileText,
  globe: Globe,
  mail: Mail,
  scale: Scale,
  search: Search,
  settings: Settings2,
  share: Share2,
  sparkles: Sparkles,
  upload: Upload,
  user: User,
  users: Users,
  zap: Zap,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

/**
 * Tinted surfaces for the icon tiles.
 *
 * Each tone is a matched trio — a pale fill, a slightly deeper border, and a
 * saturated icon — so tiles read as one family rather than as six unrelated
 * colours. Kept deliberately low-chroma: the accent should draw the eye to the
 * shape of the workflow, not compete with the type.
 */
export const TONES = {
  blue: 'bg-[#eef4ff] border-[#d8e4fd] text-[#2563eb]',
  indigo: 'bg-[#eef2ff] border-[#dce1fb] text-[#4f46e5]',
  green: 'bg-[#ecfaf1] border-[#d1eddc] text-[#15803d]',
  amber: 'bg-[#fef7e9] border-[#f2e4c4] text-[#b45309]',
  violet: 'bg-[#f5f1fe] border-[#e5dcfa] text-[#7c3aed]',
  slate: 'bg-[#f1f3f7] border-[#e0e4ec] text-[#475569]',
  danger: 'bg-[#fdf1f0] border-[#f5d8d5] text-[#b3261e]',
  accent: 'bg-[#eef4ff] border-[#d8e4fd] text-[#2563eb]',
  ok: 'bg-[#ecfaf1] border-[#d1eddc] text-[#15803d]',
} as const

export type Tone = keyof typeof TONES

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-[10px]', icon: 'h-[18px] w-[18px]' },
  lg: { box: 'h-14 w-14 rounded-[14px]', icon: 'h-6 w-6' },
} as const

export function IconTile({
  name,
  tone = 'blue',
  size = 'md',
  className,
}: {
  name: IconName
  tone?: Tone
  size?: keyof typeof SIZES
  className?: string
}) {
  const Icon = ICONS[name]
  const { box, icon } = SIZES[size]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border',
        box,
        TONES[tone],
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={icon} strokeWidth={1.75} />
    </span>
  )
}

export function Icon({
  name,
  className,
}: {
  name: IconName
  className?: string
}) {
  const Component = ICONS[name]
  return <Component className={className} strokeWidth={1.75} aria-hidden="true" />
}
