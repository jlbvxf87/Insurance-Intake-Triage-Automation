import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

/**
 * Guards the two rules that must never regress, enforced by the test suite
 * rather than by discipline: secrets stay out of the repository, and no
 * credential is exposed to client-side code.
 */
describe('repository hygiene', () => {
  it('gitignores every .env variant', () => {
    const gitignore = read('.gitignore')
    for (const pattern of ['.env', '.env.local', '.env.*.local']) {
      expect(gitignore).toContain(pattern)
    }
  })

  it('has no committed .env file', () => {
    for (const f of ['.env', '.env.local', '.env.production']) {
      expect(existsSync(resolve(root, f))).toBe(false)
    }
  })

  it('ships .env.example with no populated secret values', () => {
    const example = read('.env.example')
    const secretKeys = [
      'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
      'AZURE_DOCUMENT_INTELLIGENCE_KEY',
      'DATAVERSE_CLIENT_SECRET',
    ]

    for (const key of secretKeys) {
      const match = example.match(new RegExp(`^${key}=(.*)$`, 'm'))
      expect(match, `${key} missing from .env.example`).not.toBeNull()
      expect(match![1].trim(), `${key} must ship empty`).toBe('')
    }
  })

  it('declares no NEXT_PUBLIC_ variable in .env.example', () => {
    // NEXT_PUBLIC_ variables are inlined into the client bundle. Nothing this
    // system configures belongs there.
    expect(read('.env.example')).not.toMatch(/^NEXT_PUBLIC_/m)
  })
})
