/**
 * Adapter selection (IR-002).
 *
 * The only place that decides which extraction implementation runs. Because
 * the decision is made from resolved configuration, switching providers is a
 * configuration change and nothing downstream is aware of it.
 */

import type { AppConfig } from '../config'
import { AzureDocumentIntelligenceAdapter } from './azure-adapter'
import { FixtureExtractionAdapter } from './fixture-adapter'
import type { ExtractionAdapter } from './types'

export function createExtractionAdapter(config: AppConfig): ExtractionAdapter {
  return config.extractionProvider === 'azure'
    ? new AzureDocumentIntelligenceAdapter(config)
    : new FixtureExtractionAdapter()
}

export { AzureDocumentIntelligenceAdapter } from './azure-adapter'
export { FixtureExtractionAdapter, FailingExtractionAdapter } from './fixture-adapter'
export { normalizeAzureResult, parseCurrency, parseDate, parsePolicyType } from './normalize'
export * from './types'
