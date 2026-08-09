/**
 * Identifier generation.
 *
 * Human-readable prefixed ids rather than raw GUIDs: `SUB-10241` is a
 * reference an operator can read over the phone and a submitter can quote back.
 * In Dataverse these correspond to an Autonumber column, with the GUID primary
 * key retained underneath — see `dataverse/schema.md`.
 */

const counters: Record<string, number> = {}

/**
 * Monotonic per-prefix counter. Deterministic within a process, which keeps
 * tests readable — a run always produces `SUB-10001`, `SUB-10002`, and so on.
 */
export function nextId(prefix: string, start = 10001): string {
  counters[prefix] = (counters[prefix] ?? start - 1) + 1
  return `${prefix}-${counters[prefix]}`
}

/** Reset counters. Test-only, so each suite starts from a known state. */
export function resetIds(): void {
  for (const key of Object.keys(counters)) delete counters[key]
}

/** Seed a counter so seeded records and runtime records never collide. */
export function seedCounter(prefix: string, value: number): void {
  counters[prefix] = Math.max(counters[prefix] ?? 0, value)
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
