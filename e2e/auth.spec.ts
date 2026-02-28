/**
 * E2E: Authentication flow (guest-first)
 *
 * The app uses a guest-first model: no auth modal on page load.
 * Guests get a session automatically and can run up to 5 comparisons.
 * Signing in / registering is triggered via the "Sign in" header button.
 *
 * Run: npx playwright test e2e/auth.spec.ts
 * Requires: npm run dev running, or use `npm run test:e2e` (starts dev server automatically).
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = `e2e-auth-${Date.now()}@example.com`
const TEST_PASSWORD = 'Str0ngP@ss!'
const TEST_NAME = 'E2E Auth User'

/** Open the auth modal from the header "Sign in" button. */
async function openAuthModal(page: Page) {
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 })
}

test.describe('Guest-first page load', () => {
  test('page loads WITHOUT showing an auth modal', async ({ page }) => {
    await page.goto('/')
    // Wait for the guest init to settle
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('main playground UI is immediately accessible (no gate)', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /AI Model Playground/i })).toBeVisible()
    await expect(page.getByPlaceholder(/enter your prompt/i)).toBeVisible()
  })

  test('"Sign in" button is visible for guest users', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible()
  })

  test('clicking "Sign in" opens the auth modal', async ({ page }) => {
    await page.goto('/')
    await openAuthModal(page)
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('Login form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await openAuthModal(page)
  })

  test('shows the login form by default (not the gate/register screen)', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/^password/i)).toBeVisible()
  })

  test('shows a password validation error for short passwords', async ({ page }) => {
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/^password/i).fill('short')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible()
  })

  test('shows an email validation error for malformed emails', async ({ page }) => {
    await page.getByLabel(/email/i).fill('not-an-email')
    await page.getByLabel(/^password/i).fill('password123')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByText(/valid email/i)).toBeVisible()
  })

  test('can switch to the register form via "Create one free"', async ({ page }) => {
    await page.getByText('Create one free').click()
    await expect(page.getByText('Create your account')).toBeVisible()
    await expect(page.getByLabel(/name/i)).toBeVisible()
  })
})

test.describe('Registration flow', () => {
  test('can register a new account and sees the main UI', async ({ page }) => {
    await page.goto('/')
    await openAuthModal(page)

    // Switch to register form
    await page.getByText('Create one free').click()
    await expect(page.getByText('Create your account')).toBeVisible()

    await page.getByLabel(/name/i).fill(TEST_NAME)
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/^password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /create account/i }).click()

    // Dialog should close after successful registration
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

    // The header should show the user name or email
    await expect(page.getByText(new RegExp(TEST_NAME, 'i'))).toBeVisible()

    // "Log out" button should be visible
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
  })
})

test.describe('Login flow', () => {
  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/')
    await openAuthModal(page)

    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/^password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    // Server returns an error
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
  })

  test('can log in with valid credentials', async ({ page }) => {
    await page.goto('/')
    await openAuthModal(page)

    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/^password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    // Dialog closes on success
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

    // Now logged in as real user
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
  })
})

test.describe('Logout flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before testing logout
    await page.goto('/')
    await openAuthModal(page)
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/^password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  })

  test('"Log out" button is visible after login', async ({ page }) => {
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
  })

  test('after logout, "Sign in" button returns (no blocking modal)', async ({ page }) => {
    await page.getByRole('button', { name: /log out/i }).click()

    // A new guest session is created — NO auth modal auto-opens
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })

    // Sign in button is visible again
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible()
  })
})
