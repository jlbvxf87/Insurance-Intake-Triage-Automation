/**
 * Joins class names, dropping falsy values. Small enough not to warrant a
 * dependency; the conditional-className pattern is the only feature used.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
