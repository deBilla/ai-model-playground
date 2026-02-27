/**
 * E2E: Comparison page — prompt input, model panels, history drawer
 *
 * These tests verify UI interactions that do not depend on AI API responses.
 * They test structural and interactive elements.
 *
 * Run: npx playwright test e2e/compare.spec.ts
 * Note: Tests that actually submit a prompt require a valid VERCEL_AI_GATEWAY_KEY.
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = `compare-${Date.now()}@example.com`
const TEST_PASSWORD = 'Str0ngP@ss!'

async function login(page: Page) {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Register' }).click()
  await page.getByLabel(/email/i).fill(TEST_EMAIL)
  await page.getByLabel(/^password/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 })
}

test.describe('Prompt input', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('renders the prompt textarea and Compare Models button', async ({ page }) => {
    await expect(page.getByPlaceholder(/enter your prompt/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /compare models/i })).toBeVisible()
  })

  test('Compare Models button is disabled when the textarea is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /compare models/i })).toBeDisabled()
  })

  test('Compare Models button is enabled after typing a prompt', async ({ page }) => {
    await page.getByPlaceholder(/enter your prompt/i).fill('Hello')
    await expect(page.getByRole('button', { name: /compare models/i })).toBeEnabled()
  })

  test('character count is displayed while typing', async ({ page }) => {
    const textarea = page.getByPlaceholder(/enter your prompt/i)
    await textarea.fill('Hello world')
    await expect(page.getByText('11 characters')).toBeVisible()
  })

  test('Cmd+Enter submits the prompt (starts streaming)', async ({ page }) => {
    await page.getByPlaceholder(/enter your prompt/i).fill('Say hi')
    await page.keyboard.press('Meta+Enter')
    // Stop button should appear while streaming
    await expect(page.getByRole('button', { name: /stop/i })).toBeVisible({ timeout: 3000 })
  })

  test('Stop button aborts streams and disappears', async ({ page }) => {
    await page.getByPlaceholder(/enter your prompt/i).fill('Count to 1000')
    await page.getByRole('button', { name: /compare models/i }).click()
    await expect(page.getByRole('button', { name: /stop/i })).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: /stop/i }).click()
    await expect(page.getByRole('button', { name: /stop/i })).not.toBeVisible({ timeout: 3000 })
  })
})

test.describe('Header and navigation', () => {
  test('shows the app title', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /AI Model Playground/i })).toBeVisible()
  })

  test('shows model names in the subtitle', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/GPT-4o/i)).toBeVisible()
    await expect(page.getByText(/Claude/i)).toBeVisible()
    await expect(page.getByText(/Grok/i)).toBeVisible()
  })
})

test.describe('History drawer', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('History trigger button is visible on the right edge', async ({ page }) => {
    await expect(page.getByRole('button', { name: /open comparison history/i })).toBeVisible()
  })

  test('clicking History opens the drawer', async ({ page }) => {
    await page.getByRole('button', { name: /open comparison history/i }).click()
    await expect(page.getByRole('dialog', { name: /comparison history/i }).or(
      page.getByText('Comparison History')
    )).toBeVisible({ timeout: 3000 })
  })

  test('empty history shows a prompt to run first comparison', async ({ page }) => {
    await page.getByRole('button', { name: /open comparison history/i }).click()
    await expect(page.getByText(/no comparisons yet/i)).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Share page', () => {
  test('share page returns 404 for an unknown token', async ({ page }) => {
    const response = await page.goto('/share/this-token-does-not-exist')
    // Next.js returns 404 for notFound() calls
    expect(response?.status()).toBe(404)
  })
})
