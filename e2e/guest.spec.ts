/**
 * E2E: Guest session flow
 *
 * Verifies that the app works correctly for anonymous (guest) users:
 * - No blocking modal on first load
 * - Guest session is initialised automatically
 * - Playground is immediately usable
 * - "Sign in" button is visible and opens the auth modal
 * - No "Log out" button for guests
 *
 * Run: npx playwright test e2e/guest.spec.ts
 */
import { test, expect } from '@playwright/test'

test.describe('Guest session', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure we always start as a fresh guest
    await page.context().clearCookies()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('does not show an auth modal on first load', async ({ page }) => {
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('renders the main playground heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /AI Model Playground/i })).toBeVisible()
  })

  test('prompt textarea is visible and editable for guests', async ({ page }) => {
    const textarea = page.getByPlaceholder(/enter your prompt/i)
    await expect(textarea).toBeVisible()
    await textarea.fill('Hello guest!')
    await expect(textarea).toHaveValue('Hello guest!')
  })

  test('shows "Sign in" button in the header', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible()
  })

  test('does NOT show "Log out" button for guests', async ({ page }) => {
    await expect(page.getByRole('button', { name: /log out/i })).not.toBeVisible()
  })

  test('clicking "Sign in" opens the auth modal', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
  })

  test('auth modal opens with login form (not gate screen) for fresh guest', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).first().click()
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 })
    // Below the comparison limit → login form is shown, not the gate screen
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('does not show upgrade banner below the comparison limit', async ({ page }) => {
    // Fresh guest with 0 comparisons — banner should not appear
    await expect(page.getByText(/you've used all/i)).not.toBeVisible()
  })

  test('"Compare Models" button is disabled when prompt is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /compare models/i })).toBeDisabled()
  })

  test('"Compare Models" button is enabled after typing a prompt', async ({ page }) => {
    await page.getByPlaceholder(/enter your prompt/i).fill('Hi')
    await expect(page.getByRole('button', { name: /compare models/i })).toBeEnabled()
  })

  test('history trigger button is visible for guests', async ({ page }) => {
    await expect(page.getByRole('button', { name: /open comparison history/i })).toBeVisible()
  })

  test('history drawer shows "Sign in to view" for guest users', async ({ page }) => {
    // Guest users don't have saved history on the server
    await page.getByRole('button', { name: /open comparison history/i }).click()
    await expect(
      page.getByText(/sign in to view/i).or(page.getByText(/no comparisons yet/i))
    ).toBeVisible({ timeout: 3000 })
  })
})
