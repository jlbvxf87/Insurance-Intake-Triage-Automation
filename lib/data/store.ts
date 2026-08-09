import 'server-only'

import { InMemoryRepository } from './memory-repository'
import { createSeedData } from './seed'
import type { Repository } from './repository'

/**
 * Process-wide repository for the running application (D-002).
 *
 * Held on `globalThis` rather than in a module-level `let`, because Next.js
 * hot-reloads modules in development: a plain module binding would be
 * re-initialized on every edit, and the seeded state — plus anything submitted
 * during the session — would silently reset mid-demo.
 *
 * `server-only` at the top makes an accidental client import a build error
 * rather than a runtime surprise.
 */

declare global {
  // eslint-disable-next-line no-var
  var __iitRepository: InMemoryRepository | undefined
}

export function getRepository(): Repository {
  if (!globalThis.__iitRepository) {
    globalThis.__iitRepository = new InMemoryRepository(createSeedData())
  }
  return globalThis.__iitRepository
}

/** Reset to freshly seeded state. Used by the demo-reset endpoint. */
export function resetRepository(): Repository {
  globalThis.__iitRepository = new InMemoryRepository(createSeedData())
  return globalThis.__iitRepository
}
