import type { Repository } from './repository'
import { createSeedData } from './seed'
import { seedCounter } from '../utils/ids'

/**
 * Load the synthetic dataset into any `Repository`.
 *
 * Written against the interface rather than against Postgres, so the same
 * function seeds the in-memory store in a test and the database in production.
 * That is the whole reason the interface exists, and seeding is a good place
 * to prove it — if this needed a second implementation, the abstraction would
 * be leaking.
 *
 * Insert order follows the foreign keys: clients, then submissions, then the
 * children. `duplicateOfSubmissionId` is a self-reference, so submissions are
 * inserted without it and patched afterwards.
 */
export interface SeedResult {
  clients: number
  submissions: number
  extractions: number
  logs: number
}

export async function seedRepository(
  repository: Repository,
  now: Date = new Date(),
): Promise<SeedResult> {
  const data = createSeedData(now)

  for (const client of data.clients) {
    await repository.createClient(client)
  }

  // Pass 1: insert without the self-reference, which may point at a row that
  // does not exist yet.
  for (const submission of data.submissions) {
    await repository.createSubmission({
      ...submission,
      duplicateOfSubmissionId: null,
    })
  }

  // Pass 2: apply the self-references now that every row exists.
  for (const submission of data.submissions) {
    if (submission.duplicateOfSubmissionId) {
      await repository.updateSubmission(submission.submissionId, {
        duplicateOfSubmissionId: submission.duplicateOfSubmissionId,
        duplicateReason: submission.duplicateReason,
        duplicateFlag: submission.duplicateFlag,
      })
    }
  }

  for (const extraction of data.extractions) {
    await repository.createExtraction(extraction)
  }

  for (const log of data.logs) {
    await repository.createLog(log)
  }

  return {
    clients: data.clients.length,
    submissions: data.submissions.length,
    extractions: data.extractions.length,
    logs: data.logs.length,
  }
}

/**
 * Advance the id counters past whatever is already stored.
 *
 * With a shared database the counters cannot simply be seeded from the fixture
 * constants: a serverless instance starting up hours later must not reissue an
 * id that a previous instance already wrote. Reading the current maximum on
 * startup is what keeps `SUB-10025` from being handed out twice.
 */
export async function syncIdCountersFromStore(repository: Repository): Promise<void> {
  // Sequential rather than concurrent. Against Postgres this repository holds
  // a single pooled connection under transaction pooling, where parallel
  // queries stall rather than interleave. This runs once per instance during a
  // cold start, so three round trips are not worth a deadlock.
  const clients = await repository.listClients()
  const submissions = await repository.listSubmissions()
  const logs = await repository.listLogs()

  const highest = (ids: string[], prefix: string): number =>
    ids.reduce((max, id) => {
      const match = id.match(new RegExp(`^${prefix}-(\\d+)$`))
      return match ? Math.max(max, Number(match[1])) : max
    }, 0)

  seedCounter('CLI', highest(clients.map((c) => c.clientId), 'CLI'))
  seedCounter('SUB', highest(submissions.map((s) => s.submissionId), 'SUB'))
  seedCounter('LOG', highest(logs.map((l) => l.logId), 'LOG'))

  // Extractions are not listed by the interface; derive from the submissions
  // that have one. The fixture range starts at 20001, so the floor is safe.
  const extractionIds: string[] = []
  for (const submission of submissions) {
    const extraction = await repository.getExtractionBySubmission(submission.submissionId)
    if (extraction) extractionIds.push(extraction.extractionId)
  }
  seedCounter('EXT', highest(extractionIds, 'EXT'))
}
