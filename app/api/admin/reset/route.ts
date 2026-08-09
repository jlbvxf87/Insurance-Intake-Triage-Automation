import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import { getRepository, resetRepository } from '@/lib/data/store'
import { PostgresRepository } from '@/lib/data/postgres-repository'
import { seedRepository } from '@/lib/data/seed-repository'

/**
 * Scheduled demo reset.
 *
 * The hosted demo is publicly writable, so without this the queue slowly fills
 * with whatever visitors type and stops reading as a realistic operations
 * board. A daily truncate-and-reseed keeps it presentable and bounds how long
 * anything anyone submits persists.
 *
 * Invoked by Vercel Cron (see `vercel.json`), which presents
 * `Authorization: Bearer $CRON_SECRET`. Also callable by hand with the same
 * header, which is how the database gets its first seed.
 *
 * It is, deliberately, the same shape as the maintenance flow this system
 * would need in production — a scheduled job, authenticated, idempotent, and
 * reporting what it did.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorize(request: Request): boolean {
  const { cronSecret } = getConfig()

  // With no secret configured the endpoint is disabled rather than open.
  // An unauthenticated reset endpoint is worse than no reset endpoint.
  if (!cronSecret) return false

  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

async function reset() {
  const config = getConfig()
  const startedAt = Date.now()

  if (config.dataProvider !== 'postgres') {
    resetRepository()
    return {
      provider: 'memory' as const,
      note: 'In-memory store re-seeded for this instance only.',
      durationMs: Date.now() - startedAt,
    }
  }

  const repository = getRepository() as PostgresRepository
  await repository.truncateAll()
  const counts = await seedRepository(repository)

  return {
    provider: 'postgres' as const,
    ...counts,
    durationMs: Date.now() - startedAt,
  }
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const result = await reset()
    return NextResponse.json({ ok: true, resetAt: new Date().toISOString(), ...result })
  } catch (error) {
    // A failed reset must be visible. A cron that silently no-ops leaves a
    // demo quietly rotting, which is the failure mode this endpoint exists to
    // prevent.
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Reset failed.',
      },
      { status: 500 },
    )
  }
}

export const POST = GET
