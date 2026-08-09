/**
 * Normalization helpers.
 *
 * Client matching is the single largest source of duplicate CRM records in the
 * current state (pain point P-3). The fix is to match on a normalized key
 * rather than on whatever the submitter typed.
 */

/**
 * Trim and lower-case an email address (FR-017, DR-006).
 *
 * Deliberately *not* done: stripping `+tag` suffixes or removing dots from
 * Gmail local parts. Both are provider-specific conventions, and treating
 * `ops+claims@acme.example` as the same mailbox as `ops@acme.example` would
 * merge two addresses a client may be using intentionally. Under-matching
 * creates a duplicate record a human can merge; over-matching silently
 * attaches a submission to the wrong client.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Loose comparison key for company names. Used only for *reporting* and for
 * surfacing a possible match to a human — never for automatic linking, which
 * requires an exact normalized email (FR-019).
 */
export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(inc|llc|ltd|co|corp|company|incorporated|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Digits only, for phone comparison and storage-agnostic matching. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Collapse internal whitespace and trim. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
