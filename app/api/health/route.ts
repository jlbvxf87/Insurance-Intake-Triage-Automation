import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import { getRepository } from '@/lib/data/store'
import { PostgresRepository } from '@/lib/data/postgres-repository'

/**
 * Health and configuration diagnostic.
 *
 * Exists because "the app says `memory` but I set the variable" is otherwise a
 * guessing game across three dashboards. It answers the only questions that
 * matter — which variable names the runtime can actually see, and whether the
 * database is reachable — without ever revealing a value.
 *
 * **What this deliberately does not return.** No connection string, no
 * password, no key, not even a masked fragment of one. Only booleans for
 * presence, plus row counts. A diagnostic that leaks the thing it is
 * diagnosing is worse than no diagnostic.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Every variable name that could carry a connection string, in priority order. */
const CONNECTION_VARIABLES = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
] as const

/** Other names worth reporting presence for, to confirm an integration attached. */
const RELATED_VARIABLES = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'POSTGRES_HOST',
  'CRON_SECRET',
  'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
  'AZURE_DOCUMENT_INTELLIGENCE_KEY',
] as const

const present = (name: string): boolean => {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() !== ''
}

export async function GET() {
  const config = getConfig()

  const detected: Record<string, boolean> = {}
  for (const name of [...CONNECTION_VARIABLES, ...RELATED_VARIABLES]) {
    detected[name] = present(name)
  }

  /**
   * Host only — never the user, password, or full URI. Enough to confirm the
   * shared pooler is in use rather than the IPv6-only direct host, which is
   * the mistake this endpoint exists to catch.
   */
  let databaseHost: string | null = null
  if (config.databaseUrl) {
    try {
      const url = new URL(config.databaseUrl)
      databaseHost = `${url.hostname}:${url.port || '5432'}`
    } catch {
      databaseHost = 'unparseable — check the connection string format'
    }
  }

  const body: Record<string, unknown> = {
    ok: true,
    dataProvider: config.dataProvider,
    extractionProvider: config.extractionProvider,
    databaseHost,
    usesSharedPooler: databaseHost?.includes('.pooler.supabase.com') ?? null,
    detectedVariables: detected,
    /**
     * The *values* of the two provider switches. Neither is a secret — they are
     * mode names — and a stale `DATA_PROVIDER=memory` left over from an earlier
     * deployment is otherwise invisible from the outside.
     */
    configuredSwitches: {
      DATA_PROVIDER: process.env.DATA_PROVIDER ?? null,
      EXTRACTION_PROVIDER: process.env.EXTRACTION_PROVIDER ?? null,
    },
    // Vercel sets these itself; useful for confirming which build is serving.
    deployment: {
      environment: process.env.VERCEL_ENV ?? 'local',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
  }

  if (config.dataProvider === 'postgres') {
    const repository = getRepository() as PostgresRepository
    const reachable = await repository.ping()
    body.database = { reachable, seeded: null as boolean | null, counts: null }

    if (reachable) {
      try {
        // Sequential, not concurrent: a single pooled connection under
        // transaction pooling stalls on parallel queries. This endpoint hung
        // on exactly that before the repository was fixed.
        const clients = await repository.listClients()
        const submissions = await repository.listSubmissions()
        const logs = await repository.listLogs()
        body.database = {
          reachable: true,
          seeded: clients.length > 0,
          counts: {
            clients: clients.length,
            submissions: submissions.length,
            logs: logs.length,
          },
        }
      } catch (error) {
        body.ok = false
        body.database = {
          reachable: true,
          seeded: null,
          error: error instanceof Error ? error.message : 'Query failed.',
        }
      }
    } else {
      body.ok = false
      body.hint =
        'Connection string present but the database is unreachable. Most often the host is db.<ref>.supabase.co, which is IPv6-only without the IPv4 add-on and cannot be reached from Vercel. Use the shared transaction pooler instead (host ends .pooler.supabase.com).'
    }
  } else {
    body.hint = CONNECTION_VARIABLES.some((name) => detected[name])
      ? 'A connection variable is present but DATA_PROVIDER resolved to memory. Check DATA_PROVIDER is unset or set to auto.'
      : 'No connection variable is visible to this deployment. Either none is set, it was added to a different environment than the one serving this request, or it was set on a different project. Environment variable changes require a new deployment.'
  }

  return NextResponse.json(body, { status: body.ok ? 200 : 503 })
}
