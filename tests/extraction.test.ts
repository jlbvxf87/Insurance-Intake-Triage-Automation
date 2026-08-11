import { describe, it, expect } from 'vitest'
import {
  normalizeAzureResult,
  parseCurrency,
  parseDate,
  parsePolicyType,
} from '@/lib/extraction/normalize'
import { AzureDocumentIntelligenceAdapter } from '@/lib/extraction/azure-adapter'
import { FixtureExtractionAdapter } from '@/lib/extraction/fixture-adapter'
import { createExtractionAdapter } from '@/lib/extraction'
import { azureAnalyzeResultSchema } from '@/lib/domain/schemas'
import { getConfig } from '@/lib/config'
import type { AppConfig } from '@/lib/config'
import type { ExtractionInput } from '@/lib/extraction/types'

const input: ExtractionInput = {
  fileName: 'dec-page.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  bytes: new ArrayBuffer(16),
}

function azureConfig(overrides: Partial<AppConfig['azure']> = {}): AppConfig {
  const base = getConfig({
    EXTRACTION_PROVIDER: 'azure',
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: 'https://example.cognitiveservices.azure.com',
    AZURE_DOCUMENT_INTELLIGENCE_KEY: 'test-key',
    AZURE_REQUEST_TIMEOUT_MS: '2000',
  })
  return { ...base, azure: { ...base.azure, ...overrides } }
}

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

// ===========================================================================
// Coercion
// ===========================================================================

describe('currency parsing', () => {
  it('strips symbols and US thousands separators', () => {
    expect(parseCurrency('$1,000,000')).toBe(1_000_000)
    expect(parseCurrency('USD 1000000')).toBe(1_000_000)
    expect(parseCurrency('1,000,000.50')).toBe(1_000_000.5)
  })

  it('handles European separator conventions', () => {
    expect(parseCurrency('1.000.000,00')).toBe(1_000_000)
    expect(parseCurrency('2.500,75')).toBe(2_500.75)
  })

  it('passes a number through unchanged', () => {
    expect(parseCurrency(750_000)).toBe(750_000)
  })

  it('returns null for unparseable or negative input', () => {
    expect(parseCurrency('see schedule')).toBeNull()
    expect(parseCurrency('')).toBeNull()
    expect(parseCurrency(null)).toBeNull()
    expect(parseCurrency('-500')).toBeNull()
  })
})

describe('date parsing', () => {
  it('accepts ISO dates unchanged', () => {
    expect(parseDate('2026-01-01')).toBe('2026-01-01')
  })

  it('accepts US formats and pads single digits', () => {
    expect(parseDate('01/01/2026')).toBe('2026-01-01')
    expect(parseDate('1/1/2026')).toBe('2026-01-01')
    expect(parseDate('3-4-2026')).toBe('2026-03-04')
  })

  it('expands two-digit years to 20xx', () => {
    // A documented assumption: in this domain a policy dated 01/01/26 means
    // 2026, not 1926. See ai/validation-rules.md §3.
    expect(parseDate('01/01/26')).toBe('2026-01-01')
  })

  it('accepts long-form dates', () => {
    expect(parseDate('January 1, 2026')).toBe('2026-01-01')
  })

  it('returns null rather than guessing at unparseable input', () => {
    expect(parseDate('sometime next spring')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate(null)).toBeNull()
  })
})

describe('policy type mapping', () => {
  it('matches the option set exactly where possible', () => {
    expect(parsePolicyType('Commercial Auto')).toBe('Commercial Auto')
    expect(parsePolicyType('commercial property')).toBe('Commercial Property')
  })

  it('maps common free-text variants', () => {
    expect(parsePolicyType('Business Auto Coverage')).toBe('Commercial Auto')
    expect(parsePolicyType('Trucking Liability')).toBe('Commercial Auto')
    expect(parsePolicyType('CGL')).toBe('General Liability')
    expect(parsePolicyType("Workers' Comp")).toBe('Workers Compensation')
    expect(parsePolicyType('Excess Liability')).toBe('Umbrella')
  })

  it('returns Unknown rather than forcing a match', () => {
    expect(parsePolicyType('Marine Cargo')).toBe('Unknown')
    expect(parsePolicyType('')).toBe('Unknown')
    expect(parsePolicyType(null)).toBe('Unknown')
  })
})

// ===========================================================================
// Normalization
// ===========================================================================

describe('Azure response normalization (FR-022)', () => {
  const keyValueResponse = {
    status: 'succeeded',
    analyzeResult: {
      modelId: 'prebuilt-layout',
      keyValuePairs: [
        { key: { content: 'Named Insured' }, value: { content: 'ACME Trucking LLC' }, confidence: 0.98 },
        { key: { content: 'Policy No.' }, value: { content: 'CA-829103' }, confidence: 0.96 },
        { key: { content: 'CARRIER' }, value: { content: 'Example Insurance' }, confidence: 0.93 },
        { key: { content: 'Effective Date' }, value: { content: '01/01/2026' }, confidence: 0.9 },
        { key: { content: 'Limit of Liability' }, value: { content: '$1,000,000' }, confidence: 0.94 },
      ],
    },
  }

  it('maps label variants onto the normalized field names', () => {
    const result = normalizeAzureResult(keyValueResponse)
    expect(result.ok).toBe(true)
    expect(result.data?.namedInsured).toBe('ACME Trucking LLC')
    expect(result.data?.policyNumber).toBe('CA-829103')
    expect(result.data?.carrier).toBe('Example Insurance')
    expect(result.data?.effectiveDate).toBe('2026-01-01')
    expect(result.data?.coverageAmount).toBe(1_000_000)
  })

  it('computes the aggregate as the mean of per-field confidences', () => {
    const result = normalizeAzureResult(keyValueResponse)
    const expected = (0.98 + 0.96 + 0.93 + 0.9 + 0.94) / 5
    expect(result.data?.extractionConfidence).toBeCloseTo(expected, 4)
  })

  it('retains every per-field confidence (BR-018)', () => {
    const result = normalizeAzureResult(keyValueResponse)
    expect(Object.keys(result.data!.fieldConfidence).sort()).toEqual(
      ['carrier', 'coverageAmount', 'effectiveDate', 'namedInsured', 'policyNumber'].sort(),
    )
  })

  it('reads named fields from a trained model response', () => {
    const result = normalizeAzureResult({
      status: 'succeeded',
      analyzeResult: {
        modelId: 'custom-acord',
        documents: [
          {
            docType: 'acord',
            fields: {
              namedInsured: { valueString: 'Belmont Fabrication Co', confidence: 0.95 },
              policyNumber: { valueString: 'WC-55120-B', confidence: 0.91 },
              carrier: { valueString: 'Granite State Casualty', confidence: 0.88 },
              coverageAmount: { valueCurrency: { amount: 1_000_000 }, confidence: 0.9 },
            },
          },
        ],
      },
    })

    expect(result.ok).toBe(true)
    expect(result.data?.namedInsured).toBe('Belmont Fabrication Co')
    expect(result.data?.coverageAmount).toBe(1_000_000)
  })

  it('prefers a trained model field over a key/value pair for the same target', () => {
    const result = normalizeAzureResult({
      analyzeResult: {
        keyValuePairs: [
          { key: { content: 'Policy Number' }, value: { content: 'FROM-KVP' }, confidence: 0.5 },
        ],
        documents: [
          { fields: { policyNumber: { valueString: 'FROM-FIELD', confidence: 0.95 } } },
        ],
      },
    })
    expect(result.data?.policyNumber).toBe('FROM-FIELD')
  })

  it('fails rather than returning empty data when nothing is recognizable', () => {
    const result = normalizeAzureResult({
      analyzeResult: {
        keyValuePairs: [
          { key: { content: 'Favourite Colour' }, value: { content: 'Blue' }, confidence: 0.99 },
        ],
      },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No recognizable policy fields/)
  })

  it('fails on an entirely empty response', () => {
    expect(normalizeAzureResult({}).ok).toBe(false)
  })

  it('yields aggregate 0 when no confidences are supplied, which routes to review', () => {
    const result = normalizeAzureResult({
      analyzeResult: {
        keyValuePairs: [
          { key: { content: 'Named Insured' }, value: { content: 'ACME Trucking LLC' } },
        ],
      },
    })
    expect(result.ok).toBe(true)
    expect(result.data?.extractionConfidence).toBe(0)
  })

  it('clamps a confidence returned outside 0..1', () => {
    const result = normalizeAzureResult({
      analyzeResult: {
        keyValuePairs: [
          { key: { content: 'Named Insured' }, value: { content: 'ACME' }, confidence: 4.2 },
        ],
      },
    })
    expect(result.data?.extractionConfidence).toBe(1)
  })

  it('sets an unparseable date to null rather than failing the whole extraction', () => {
    const result = normalizeAzureResult({
      analyzeResult: {
        keyValuePairs: [
          { key: { content: 'Named Insured' }, value: { content: 'ACME' }, confidence: 0.9 },
          { key: { content: 'Effective Date' }, value: { content: 'next spring' }, confidence: 0.4 },
        ],
      },
    })
    expect(result.ok).toBe(true)
    expect(result.data?.effectiveDate).toBeNull()
  })
})

describe('Azure response schema (IR-004)', () => {
  it('ignores unknown properties so an additive upstream change does not break intake', () => {
    const parsed = azureAnalyzeResultSchema.safeParse({
      status: 'succeeded',
      somethingNew: { nested: true },
      analyzeResult: { documents: [], futureField: 42 },
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a payload whose load-bearing structure is wrong', () => {
    expect(
      azureAnalyzeResultSchema.safeParse({ analyzeResult: { documents: 'not-an-array' } }).success,
    ).toBe(false)
    expect(
      azureAnalyzeResultSchema.safeParse({ analyzeResult: { keyValuePairs: {} } }).success,
    ).toBe(false)
  })
})

// ===========================================================================
// Azure adapter
// ===========================================================================

describe('Azure adapter (IR-001, IR-003)', () => {
  const succeeded = {
    status: 'succeeded',
    analyzeResult: {
      keyValuePairs: [
        { key: { content: 'Named Insured' }, value: { content: 'ACME Trucking LLC' }, confidence: 0.95 },
        { key: { content: 'Policy Number' }, value: { content: 'CA-829103' }, confidence: 0.93 },
        { key: { content: 'Carrier' }, value: { content: 'Example Insurance' }, confidence: 0.9 },
      ],
    },
  }

  it('returns not_configured rather than silently degrading', async () => {
    const config = getConfig({ EXTRACTION_PROVIDER: 'azure' })
    const result = await new AzureDocumentIntelligenceAdapter(config).extract(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.kind).toBe('not_configured')
      expect(result.message).toMatch(/AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT/)
    }
  })

  it('submits the document with the key in the header and the mime type as content type', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return jsonResponse(succeeded)
    }) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
    }).extract(input)

    expect(result.ok).toBe(true)
    expect(calls[0].url).toContain('/documentintelligence/documentModels/prebuilt-layout:analyze')
    // v4.0 returns key-value pairs only when asked for them.
    expect(calls[0].url).toContain('features=keyValuePairs')
    expect(calls[0].url).toContain('api-version=2024-11-30')

    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('test-key')
    expect(headers['Content-Type']).toBe('application/pdf')
  })

  it('polls the operation location until it succeeds', async () => {
    let polls = 0
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes(':analyze')) {
        return new Response(null, {
          status: 202,
          headers: { 'operation-location': 'https://example.test/operations/1' },
        })
      }
      polls += 1
      return jsonResponse(polls < 2 ? { status: 'running' } : succeeded)
    }) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
      pollIntervalMs: 1,
    }).extract(input)

    expect(result.ok).toBe(true)
    expect(polls).toBe(2)
  })

  it('retries a 503 and succeeds on a later attempt', async () => {
    let attempts = 0
    const fetchImpl = (async () => {
      attempts += 1
      if (attempts < 3) return new Response('', { status: 503, statusText: 'Service Unavailable' })
      return jsonResponse(succeeded)
    }) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
      pollIntervalMs: 1,
    }).extract(input)

    expect(result.ok).toBe(true)
    expect(attempts).toBe(3)
  })

  it('gives up after the retry budget and reports a service error', async () => {
    let attempts = 0
    const fetchImpl = (async () => {
      attempts += 1
      return new Response('', { status: 503, statusText: 'Service Unavailable' })
    }) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
      pollIntervalMs: 1,
      maxAttempts: 3,
    }).extract(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.kind).toBe('service_error')
      expect(result.attempts).toBe(3)
      expect(result.message).toMatch(/503/)
    }
    expect(attempts).toBe(3)
  })

  it('does not retry a 400 — a malformed request will not improve', async () => {
    let attempts = 0
    const fetchImpl = (async () => {
      attempts += 1
      return new Response('', { status: 400, statusText: 'Bad Request' })
    }) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
      pollIntervalMs: 1,
    }).extract(input)

    expect(result.ok).toBe(false)
    expect(attempts).toBe(1)
  })

  it('retries a 429', async () => {
    let attempts = 0
    const fetchImpl = (async () => {
      attempts += 1
      if (attempts === 1) return new Response('', { status: 429, statusText: 'Too Many Requests' })
      return jsonResponse(succeeded)
    }) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
      pollIntervalMs: 1,
    }).extract(input)

    expect(result.ok).toBe(true)
    expect(attempts).toBe(2)
  })

  it('converts an aborted request into a timeout (IR-003)', async () => {
    const fetchImpl = (async () => {
      const error = new Error('The operation was aborted.')
      error.name = 'AbortError'
      throw error
    }) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(
      azureConfig(),
      { fetchImpl, pollIntervalMs: 1 },
    ).extract(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.kind).toBe('timeout')
      expect(result.message).toMatch(/timed out/)
    }
  })

  it('treats a schema-invalid response as malformed, not as data (IR-004)', async () => {
    const fetchImpl = (async () =>
      jsonResponse({ analyzeResult: { documents: 'not-an-array' } })) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
      pollIntervalMs: 1,
    }).extract(input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('malformed_response')
  })

  it('treats a well-formed but unusable response as malformed', async () => {
    const fetchImpl = (async () =>
      jsonResponse({ status: 'succeeded', analyzeResult: { keyValuePairs: [] } })) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
      pollIntervalMs: 1,
    }).extract(input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.kind).toBe('malformed_response')
  })

  it('surfaces a failed analyze operation', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes(':analyze')) {
        return new Response(null, {
          status: 202,
          headers: { 'operation-location': 'https://example.test/operations/1' },
        })
      }
      return jsonResponse({ status: 'failed', error: { message: 'Unsupported document format.' } })
    }) as unknown as typeof fetch

    const result = await new AzureDocumentIntelligenceAdapter(azureConfig(), {
      fetchImpl,
      pollIntervalMs: 1,
      maxAttempts: 1,
    }).extract(input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/Unsupported document format/)
  })

  it('never throws — every failure is returned', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch

    await expect(
      new AzureDocumentIntelligenceAdapter(azureConfig(), {
        fetchImpl,
        pollIntervalMs: 1,
        maxAttempts: 2,
      }).extract(input),
    ).resolves.toMatchObject({ ok: false })
  })
})

// ===========================================================================
// Fixture adapter
// ===========================================================================

describe('fixture adapter (FR-026)', () => {
  const adapter = new FixtureExtractionAdapter(0)

  it('labels every result as fixture-produced', async () => {
    const result = await adapter.extract(input)
    expect(result.provider).toBe('fixture')
  })

  it('selects a fixture by file name', async () => {
    const high = await adapter.extract({ ...input, fileName: 'acme-dec-page.pdf' })
    const low = await adapter.extract({ ...input, fileName: 'belmont-scan.pdf' })

    expect(high.ok && high.data.extractionConfidence).toBeGreaterThan(0.9)
    expect(low.ok && low.data.extractionConfidence).toBeLessThan(0.7)
  })

  it('falls back to the high-confidence fixture for an unrecognized name', async () => {
    const result = await adapter.extract({ ...input, fileName: 'whatever.pdf' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.namedInsured).toBe('ACME Trucking LLC')
  })

  it('is deterministic across calls', async () => {
    const a = await adapter.extract({ ...input, fileName: 'dec-page.pdf' })
    const b = await adapter.extract({ ...input, fileName: 'dec-page.pdf' })
    expect(a.ok && a.data).toEqual(b.ok && b.data)
  })

  it('exposes each failure path through a file-name trigger', async () => {
    const cases = [
      ['trigger-timeout.pdf', 'timeout'],
      ['trigger-error.pdf', 'service_error'],
      ['trigger-malformed.pdf', 'malformed_response'],
    ] as const

    for (const [fileName, kind] of cases) {
      const result = await adapter.extract({ ...input, fileName })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.kind).toBe(kind)
    }
  })

  it('validates fixtures through the same schema as a live response', async () => {
    const result = await adapter.extract({ ...input, fileName: 'boundary.pdf' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.extractionConfidence).toBe(0.8)
  })
})

describe('adapter selection (IR-002)', () => {
  it('returns the fixture adapter when no credentials are configured', () => {
    expect(createExtractionAdapter(getConfig({})).provider).toBe('fixture')
  })

  it('returns the Azure adapter when credentials are present', () => {
    expect(createExtractionAdapter(azureConfig()).provider).toBe('azure')
  })
})
