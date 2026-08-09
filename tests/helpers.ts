import { getConfig, type AppConfig } from '@/lib/config'
import { InMemoryRepository } from '@/lib/data/memory-repository'
import { createSeedData } from '@/lib/data/seed'
import { FixtureExtractionAdapter } from '@/lib/extraction/fixture-adapter'
import type { ExtractionAdapter } from '@/lib/extraction/types'
import type { IntakeFormValues } from '@/lib/domain/schemas'
import type { WorkflowDocument } from '@/lib/workflow/orchestrator'
import { resetIds } from '@/lib/utils/ids'

/** Fixed reference instant so duplicate-window boundaries are exact. */
export const NOW = '2026-08-09T15:00:00.000Z'

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...getConfig({ EXTRACTION_PROVIDER: 'fixture' }), ...overrides }
}

export function freshRepository(seeded = true): InMemoryRepository {
  resetIds()
  return new InMemoryRepository(seeded ? createSeedData(new Date(NOW)) : undefined)
}

export const validInput = (overrides: Partial<IntakeFormValues> = {}): IntakeFormValues => ({
  clientName: 'Dana Whitfield',
  companyName: 'ACME Trucking LLC',
  email: 'dispatch@acmetrucking.example',
  phone: '(816) 555-0142',
  submissionType: 'Quote',
  lineOfBusiness: 'Commercial Auto',
  description:
    'Adding six tractors and four trailers to the fleet ahead of the Q3 contract.',
  ...overrides,
})

export const documentNamed = (fileName: string): WorkflowDocument => ({
  fileName,
  mimeType: 'application/pdf',
  sizeBytes: 240_000,
  bytes: new ArrayBuffer(16),
})

/** No artificial latency — tests should not wait on a demo delay. */
export const instantExtractor = (): ExtractionAdapter => new FixtureExtractionAdapter(0)
