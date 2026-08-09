/**
 * Captures the screenshots in demo/screenshots/ from a running server.
 *
 *   npm run build && npm start &
 *   node scripts/capture-screenshots.mjs
 *
 * Set PW_CHROMIUM to point at a Chromium binary when Playwright's own download
 * is unavailable (CI sandboxes, air-gapped builds).
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../demo/screenshots')
const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
)

async function shot(name, url, { width = 1440, height = 900, full = false, before } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' })
  if (before) await before(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
  await page.close()
  console.log('✓', name)
}

await shot('01-intake-form', '/intake', { full: true })
await shot('02-intake-validation', '/intake', {
  full: true,
  before: async (page) => {
    await page.getByRole('button', { name: /submit request/i }).click()
    await page.waitForTimeout(300)
  },
})
await shot('03-ops-dashboard', '/ops', { full: true })
await shot('04-ops-needs-review', '/ops?view=needs-review', { full: true })
await shot('05-ops-exceptions', '/ops?view=exceptions', { full: true })
await shot('06-submission-low-confidence', '/ops/SUB-10016', { full: true })
await shot('07-submission-exception', '/ops/SUB-10020', { full: true })
await shot('08-submission-duplicate', '/ops/SUB-10023', { full: true })
await shot('09-intake-mobile', '/intake', { width: 390, height: 844, full: true })
await shot('10-ops-mobile', '/ops', { width: 390, height: 844, full: true })

await browser.close()
