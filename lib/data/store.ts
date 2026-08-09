import 'server-only'

import { InMemoryRepository } from './memory-repository'
import { PostgresRepository } from './postgres-repository'
import { createSeedData } from './seed'
import { seedRepository, syncIdCountersFromStore } from './seed-repository'
import { getConfig } from '../config'
import type { Repository } from './repository'

/**
 * Repository selection (IR-005, IR-002).
 *
 * The only place the application decides where records live. With a
 * `DATABASE_URL` present it is Postgres, shared across every serverless
 * instance; without one it is the in-memory demo store, which keeps a clean
 * clone and the test suite zero-config.
 *
 * `server-only` at the top makes an accidental client import a build error
 * rather than a runtime surprise — this module reaches a connection string.
 */

declare global {
  var __iitRepository: Repository | undefined
  var __iitCountersSynced: Promise<void> | undefined
  var __iitSeedChecked: Promise<void> | undefined
}

/**
 * Arbitrary but fixed key for the seeding advisory lock. Any instance using
 * this database must use the same number, so it is a constant rather than
 * something derived.
 */
const SEED_LOCK_KEY = 918_273_645

function build(): Repository {
  const config = getConfig()

  if (config.dataProvider === 'postgres') {
    if (!config.databaseUrl) {
      // Fail loudly. An operator who asked for Postgres and silently got an
      // empty in-memory store would see a demo that looks like it works and
      // loses every submission.
      throw new Error(
        'DATA_PROVIDER is set to postgres but DATABASE_URL is missing.',
      )
    }
    return new PostgresRepository(config.databaseUrl)
  }

  // Held on globalThis rather than in a module-level binding because Next.js
  // hot-reloads modules in development: a plain binding would reset seeded
  // state — plus anything submitted during the session — on every edit.
  return new InMemoryRepository(createSeedData())
}

export function getRepository(): Repository {
  globalThis.__iitRepository ??= build()
  return globalThis.__iitRepository
}

/**
 * Advance the id counters past whatever the shared store already contains.
 *
 * With a database, a serverless instance starting hours later must not reissue
 * an id a previous instance already wrote. Runs once per instance, and the
 * promise is cached so concurrent requests during a cold start wait on the
 * same query rather than racing.
 *
 * Not needed for the in-memory store, which seeds its own counters.
 */
export async function ensureIdCountersSynced(): Promise<void> {
  if (getConfig().dataProvider !== 'postgres') return

  globalThis.__iitCountersSynced ??= syncIdCountersFromStore(getRepository()).catch(
    (error) => {
      // Clear the cache so the next request retries rather than being stuck
      // with counters that were never synchronized.
      globalThis.__iitCountersSynced = undefined
      throw error
    },
  )

  await globalThis.__iitCountersSynced
}

/**
 * Seed the shared store on first use.
 *
 * Makes deployment a single step: set the connection string, deploy, and the
 * first request populates an empty database. Without this the demo would come
 * up showing an empty queue until someone remembered to run a seed command —
 * which is exactly the kind of undocumented manual step that makes a project
 * look unfinished.
 *
 * Guarded by an advisory lock because concurrent cold starts would otherwise
 * all try to seed at once. Runs once per instance; failures clear the cache so
 * the next request retries.
 */
export async function ensureSeeded(): Promise<void> {
  if (getConfig().dataProvider !== 'postgres') return

  globalThis.__iitSeedChecked ??= (async () => {
    const repository = getRepository() as PostgresRepository

    if (!(await repository.isEmpty())) return

    await repository.withAdvisoryLock(SEED_LOCK_KEY, async () => {
      // Re-check inside the lock: another instance may have seeded between
      // the first check and acquiring it.
      if (await repository.isEmpty()) {
        await seedRepository(repository)
      }
    })
  })().catch((error) => {
    globalThis.__iitSeedChecked = undefined
    throw error
  })

  await globalThis.__iitSeedChecked
}

/**
 * Everything a request needs before touching the store: seeded, and with id
 * counters past whatever is already persisted.
 */
export async function ensureStoreReady(): Promise<void> {
  await ensureSeeded()
  await ensureIdCountersSynced()
}

/** Reset to freshly seeded state. Used by the scheduled demo reset. */
export function resetRepository(): Repository {
  globalThis.__iitRepository = build()
  globalThis.__iitCountersSynced = undefined
  globalThis.__iitSeedChecked = undefined
  return globalThis.__iitRepository
}
