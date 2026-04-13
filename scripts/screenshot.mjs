#!/usr/bin/env node
/**
 * Screenshot script using Playwright headless Chromium.
 * Run: node scripts/screenshot.mjs
 */

import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../docs/screenshots')
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:3009'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' })
  const page = await ctx.newPage()

  // ── 1. Login page ──────────────────────────────────────────────────────────
  console.log('📸 login page...')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${OUT}/01-login.png`, fullPage: false })

  // ── 2. Log in as Alice ─────────────────────────────────────────────────────
  console.log('🔑 logging in as Alice...')
  await page.fill('input[type="email"]', 'alice@acmecorp.io')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/orgs**', { timeout: 10000 })

  // ── 3. Orgs list ───────────────────────────────────────────────────────────
  console.log('📸 organizations page...')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: `${OUT}/02-orgs.png`, fullPage: false })

  // ── 4. Find Acme Corp org and navigate to it ───────────────────────────────
  const orgLink = page.locator('a', { hasText: 'Acme Corp' }).first()
  const href = await orgLink.getAttribute('href')
  console.log(`  → navigating to ${href}`)
  await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${OUT}/03-org-home.png`, fullPage: false })

  // ── 5. Navigate to Website Redesign board ─────────────────────────────────
  console.log('📸 board — Website Redesign...')
  const projLink = page.locator('a', { hasText: 'Website Redesign' }).first()
  const projHref = await projLink.getAttribute('href')
  await page.goto(`${BASE}${projHref}`, { waitUntil: 'networkidle' })
  // Expand ideas column
  const ideasBtn = page.locator('button', { hasText: /Ideas/ }).first()
  if (await ideasBtn.isVisible()) await ideasBtn.click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04-board.png`, fullPage: false })

  // ── 6. Click a task card to open sidebar ──────────────────────────────────
  console.log('📸 task detail sidebar...')
  const taskCard = page.locator('[data-column="todo"], .bg-white').filter({ hasText: 'Redesign homepage hero' }).first()
  // Try clicking the first todo task card
  const cards = page.locator('.cursor-pointer').filter({ hasText: 'Redesign homepage' })
  if (await cards.count() > 0) {
    await cards.first().click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/05-task-sidebar.png`, fullPage: false })
    // Close sidebar
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  } else {
    // Try any card
    const anyCard = page.locator('h3').first()
    if (await anyCard.isVisible()) {
      await anyCard.click()
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/05-task-sidebar.png`, fullPage: false })
      await page.keyboard.press('Escape')
    }
  }

  // ── 7. Filter by tag ───────────────────────────────────────────────────────
  console.log('📸 tag filtering...')
  const frontendTag = page.locator('button, span', { hasText: /^#?frontend$/ }).first()
  if (await frontendTag.isVisible()) {
    await frontendTag.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/06-filtered.png`, fullPage: false })
    // Clear filter
    const clearBtn = page.locator('button', { hasText: '×' }).first()
    if (await clearBtn.isVisible()) await clearBtn.click()
  }

  // ── 8. Archive panel ───────────────────────────────────────────────────────
  console.log('📸 archive panel...')
  const archiveToggle = page.locator('button', { hasText: /Archive/ }).first()
  if (await archiveToggle.isVisible()) {
    await archiveToggle.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/07-archive.png`, fullPage: false })
    await archiveToggle.click() // close
  }

  // ── 9. Org settings — members ─────────────────────────────────────────────
  console.log('📸 org settings / members...')
  const settingsLink = page.locator('a', { hasText: /Settings/ }).first()
  if (await settingsLink.isVisible()) {
    await settingsLink.click()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${OUT}/08-org-settings.png`, fullPage: false })
  }

  // ── 10. Profile page ───────────────────────────────────────────────────────
  console.log('📸 profile page...')
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${OUT}/09-profile.png`, fullPage: false })

  // ── 11. Register page ──────────────────────────────────────────────────────
  console.log('📸 register page...')
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${OUT}/10-register.png`, fullPage: false })

  // ── 12. Board — Mobile App v2 ─────────────────────────────────────────────
  console.log('📸 board — Mobile App v2...')
  // Go back to orgs
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', 'alice@acmecorp.io')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/orgs**', { timeout: 10000 })
  await page.waitForLoadState('networkidle')

  // Find Mobile App link
  const mobileLink = page.locator('a', { hasText: 'Mobile App v2' }).first()
  if (await mobileLink.count() > 0) {
    const mHref = await mobileLink.getAttribute('href')
    if (mHref) {
      await page.goto(`${BASE}${mHref}`, { waitUntil: 'networkidle' })
      const ideasBtn2 = page.locator('button', { hasText: /Ideas/ }).first()
      if (await ideasBtn2.isVisible()) await ideasBtn2.click()
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT}/11-board-mobile.png`, fullPage: false })
    }
  }

  await browser.close()
  console.log(`\n✅ Screenshots saved to docs/screenshots/`)
}

main().catch(e => { console.error(e); process.exit(1) })
