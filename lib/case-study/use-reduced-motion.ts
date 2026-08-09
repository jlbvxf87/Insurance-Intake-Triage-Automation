'use client'

import { useSyncExternalStore } from 'react'

/**
 * Tracks `prefers-reduced-motion` (NFR-012).
 *
 * Implemented with `useSyncExternalStore` rather than `useState` +
 * `useEffect`. The media query *is* an external store, and reading it that way
 * avoids the render-then-correct flash that a state-in-effect version has —
 * which matters here more than usual, because one frame of unwanted animation
 * is precisely what this preference exists to prevent.
 *
 * The server snapshot is `true` — motion off — so nothing animates before the
 * preference has actually been read.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return true
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
