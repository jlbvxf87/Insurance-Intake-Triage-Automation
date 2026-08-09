/**
 * Date helpers.
 *
 * Every function takes an explicit `now` where "current time" matters. Tests
 * for the duplicate window need to control the clock, and a function that
 * reaches for `Date.now()` internally cannot be tested for boundary behaviour
 * without faking timers.
 */

import type { IsoDate, IsoDateTime } from '../domain/types'

export function nowIso(): IsoDateTime {
  return new Date().toISOString()
}

export function daysBetween(earlier: IsoDateTime, later: IsoDateTime): number {
  const ms = new Date(later).getTime() - new Date(earlier).getTime()
  return ms / (1000 * 60 * 60 * 24)
}

/** Whole days, rounded down. Used in duplicate reason text. */
export function wholeDaysBetween(
  earlier: IsoDateTime,
  later: IsoDateTime,
): number {
  return Math.floor(daysBetween(earlier, later))
}

export function isWithinDays(
  earlier: IsoDateTime,
  later: IsoDateTime,
  windowDays: number,
): boolean {
  const delta = daysBetween(earlier, later)
  return delta >= 0 && delta <= windowDays
}

export function daysAgo(days: number, from: IsoDateTime = nowIso()): IsoDateTime {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

export function isSameUtcDay(a: IsoDateTime, b: IsoDateTime): boolean {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10)
}

export function toIsoDate(value: IsoDateTime): IsoDate {
  return new Date(value).toISOString().slice(0, 10)
}

/** `9 Aug 2026`. Used in the operations dashboard. */
export function formatDate(value: IsoDateTime): string {
  return new Date(value).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** `9 Aug 2026, 14:22 UTC`. */
export function formatDateTime(value: IsoDateTime): string {
  return `${new Date(value).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })} UTC`
}

/** Relative age for queue ageing: `4h ago`, `3d ago`. */
export function formatAge(value: IsoDateTime, now: IsoDateTime = nowIso()): string {
  const minutes = Math.max(
    0,
    Math.floor((new Date(now).getTime() - new Date(value).getTime()) / 60000),
  )
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
