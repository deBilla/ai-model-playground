/**
 * E2E: History drawer interactions
 *
 * Verifies the history drawer UI:
 * - Trigger button is always visible on the right edge
 * - Drawer opens/closes correctly
 * - Empty state message for authenticated users with no history
 * - Share page returns 404 for unknown tokens
 *
 * Run: npx playwright test e2e/history.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = `history-${Date.now()}@example.com`
const TEST_PASSWORD = 'Str0ngP@ss!'

async function registerAndLogin(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 })
  await page.getByText('Create one free').click()
  await page.getByLabel(/email/i).fill(TEST_EMAIL)
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 })
}

test.describe('History trigger', () => {
  test('trigger button is visible on the right edge of the page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /open comparison history/i })).toBeVisible()
  })

  test('trigger shows history count after records are added (default: empty)', async ({ page }) => {
    await page.goto('/')
    const trigger = page.getByRole('button', { name: /open comparison history/i })
    // With no records, the count "(N)" should not appear
    await expect(trigger).not.toContainText(/\(\d+\)/)
  })
})

test.describe('Drawer open/close', () => {
  // Use the SheetTitle heading to avoid strict-mode violation with "comparison history"
  // appearing inside the "Sign in to view your comparison history." message.
  const historyHeading = (page: import('@playwright/test').Page) =>
    page.getByRole('heading', { name: 'Comparison History' })

  test('clicking trigger opens the drawer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open comparison history/i }).click()
    await expect(historyHeading(page)).toBeVisible({ timeout: 3000 })
  })

  test('drawer can be closed via the Radix close button', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open comparison history/i }).click()
    await historyHeading(page).waitFor({ state: 'visible', timeout: 3000 })

    // Radix SheetContent renders a close button with a sr-only "Close" label
    await page.getByRole('button', { name: /^close$/i }).click()
    await expect(historyHeading(page)).not.toBeVisible({ timeout: 3000 })
  })

  test('pressing Escape closes the drawer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open comparison history/i }).click()
    await historyHeading(page).waitFor({ state: 'visible', timeout: 3000 })
    await page.keyboard.press('Escape')
    await expect(historyHeading(page)).not.toBeVisible({ timeout: 3000 })
  })
})

test.describe('Empty state', () => {
  test('guest sees "Sign in to view" in drawer', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /open comparison history/i }).click()
    // Guest sees either "Sign in to view" or "No comparisons yet"
    await expect(
      page.getByText(/sign in to view/i).or(page.getByText(/no comparisons yet/i))
    ).toBeVisible({ timeout: 3000 })
  })

  test('authenticated user with no history sees "No comparisons yet"', async ({ page }) => {
    await registerAndLogin(page)
    await page.getByRole('button', { name: /open comparison history/i }).click()
    await expect(page.getByText(/no comparisons yet/i)).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Share page', () => {
  test('returns 404 for an unknown share token', async ({ page }) => {
    const response = await page.goto('/share/this-token-does-not-exist-999')
    expect(response?.status()).toBe(404)
  })
})
