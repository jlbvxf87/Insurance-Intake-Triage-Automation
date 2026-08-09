/**
 * Identifier generation.
 *
 * Human-readable prefixed ids rather than raw GUIDs: `SUB-10241` is a
 * reference an operator can read over the phone and a submitter can quote back.
 * In Dataverse these correspond to an Autonumber column, with the GUID primary
 * key retained underneath — see `dataverse/schema.md`.
 *
 * The counters live on `globalThis` rather than in a module-level object.
 * Next.js can instantiate the same module more than once across separate
 * bundles — a server component and a route handler do not necessarily share
 * one module instance — and a per-instance counter produced ids that collided
 * with seeded records. This was found by running the app, not by reading it:
 * a review action wrote `LOG-10001` while the seed had already reserved the
 * `LOG-30xxx` range.
 *
 * In Dataverse this problem does not exist, because Autonumber is allocated by
 * the platform. The global is the equivalent guarantee for the demo store.
 */

declare global {
  var __iitIdCounters: Record<string, number> | undefined
}

function counters(): Record<string, number> {
  globalThis.__iitIdCounters ??= {}
  return globalThis.__iitIdCounters
}

/**
 * Monotonic per-prefix counter. Deterministic within a process, which keeps
 * tests readable — a run always produces `SUB-10001`, `SUB-10002`, and so on.
 */
export function nextId(prefix: string, start = 10001): string {
  const store = counters()
  store[prefix] = (store[prefix] ?? start - 1) + 1
  return `${prefix}-${store[prefix]}`
}

/** Reset counters. Test-only, so each suite starts from a known state. */
export function resetIds(): void {
  globalThis.__iitIdCounters = {}
}

/** Seed a counter so seeded records and runtime records never collide. */
export function seedCounter(prefix: string, value: number): void {
  const store = counters()
  store[prefix] = Math.max(store[prefix] ?? 0, value)
}

export const newSubmissionId = () => nextId('SUB')
export const newClientId = () => nextId('CLI', 1001)
export const newExtractionId = () => nextId('EXT')
export const newLogId = () => nextId('LOG')

/**
 * Correlation id for one workflow execution. Uses `crypto.randomUUID` where
 * available — a run id must be unique across processes, unlike the readable
 * record ids above.
 */
export function newRunId(): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(16).slice(2).padEnd(12, '0')
  return `run_${uuid.replace(/-/g, '').slice(0, 16)}`
}
