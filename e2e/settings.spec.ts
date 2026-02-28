/**
 * E2E: Settings panel (temperature + max tokens sliders)
 *
 * Tests that the settings panel:
 * - Is hidden by default
 * - Toggles open/closed via the Settings button
 * - Exposes temperature and max-tokens sliders with correct initial values
 * - Updates the displayed value when the slider is changed via keyboard
 *
 * Run: npx playwright test e2e/settings.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = `settings-${Date.now()}@example.com`
const TEST_PASSWORD = 'Str0ngP@ss!'

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/')
  // Open auth modal via "Sign in" header button
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 })

  try {
    // Try to register first (fresh test run)
    await page.getByText('Create one free').click()
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/^password/i).fill(password)
    await page.getByRole('button', { name: /create account/i }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 })
  } catch {
    // Already registered — log in instead
    await page.goto('/')
    await page.getByRole('button', { name: /sign in/i }).first().click()
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 })
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/^password/i).fill(password)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 })
  }
}

test.describe('Settings panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
  })

  test('settings panel is hidden by default', async ({ page }) => {
    await expect(page.getByRole('region', { name: /generation settings/i })).not.toBeVisible()
  })

  test('clicking the Settings button reveals the panel', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).click()
    await expect(page.getByRole('region', { name: /generation settings/i })).toBeVisible()
  })

  test('clicking Settings again hides the panel', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).click()
    await expect(page.getByRole('region', { name: /generation settings/i })).toBeVisible()

    await page.getByRole('button', { name: /settings/i }).click()
    await expect(page.getByRole('region', { name: /generation settings/i })).not.toBeVisible()
  })

  test('temperature slider is present with label and default value shown', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).click()
    const panel = page.getByRole('region', { name: /generation settings/i })

    // Temperature label
    await expect(panel.getByText('Temperature')).toBeVisible()
    // Slider control
    await expect(panel.getByRole('slider', { name: /temperature/i })).toBeVisible()
    // Default value shown
    await expect(panel.getByText('1.00')).toBeVisible()
  })

  test('max tokens slider is present with label and default value shown', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).click()
    const panel = page.getByRole('region', { name: /generation settings/i })

    await expect(panel.getByText('Max Tokens')).toBeVisible()
    await expect(panel.getByRole('slider', { name: /max tokens/i })).toBeVisible()
    // Default 2048 tokens
    await expect(panel.getByText('2,048')).toBeVisible()
  })

  test('keyboard ArrowLeft on temperature slider decreases its displayed value', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).click()
    const slider = page.getByRole('slider', { name: /temperature/i })
    await slider.focus()

    // Press arrow left 10 times — each step is 0.01, so -0.10 from 1.00 → 0.90
    for (let i = 0; i < 10; i++) {
      await slider.press('ArrowLeft')
    }

    // The displayed value should now be 0.90
    const panel = page.getByRole('region', { name: /generation settings/i })
    await expect(panel.getByText('0.90')).toBeVisible()
  })

  test('keyboard ArrowRight on max-tokens slider increases its displayed value', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).click()
    const panel = page.getByRole('region', { name: /generation settings/i })
    const slider = panel.getByRole('slider', { name: /max tokens/i })
    await slider.focus()

    // Each step is 64 tokens; press 4 times → +256 from 2048 → 2304
    for (let i = 0; i < 4; i++) {
      await slider.press('ArrowRight')
    }

    await expect(panel.getByText('2,304')).toBeVisible()
  })

  test('settings persist across Settings panel open/close cycles', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).click()
    const panel = page.getByRole('region', { name: /generation settings/i })
    const tempSlider = panel.getByRole('slider', { name: /temperature/i })

    await tempSlider.focus()
    await tempSlider.press('ArrowLeft')  // 1.00 → 0.99

    // Close and reopen
    await page.getByRole('button', { name: /settings/i }).click()
    await page.getByRole('button', { name: /settings/i }).click()

    await expect(panel.getByText('0.99')).toBeVisible()
  })
})
