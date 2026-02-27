/**
 * E2E: Authentication flow
 *
 * Covers: auth modal appears on load, field validation, registration,
 * login with wrong password, successful login, logout.
 *
 * Run: npx playwright test e2e/auth.spec.ts
 * Requires: npm run dev running, or use `npm run test:e2e` (starts dev server automatically).
 */
import { test, expect } from '@playwright/test'

const TEST_EMAIL = `e2e-${Date.now()}@example.com`
const TEST_PASSWORD = 'Str0ngP@ss!'
const TEST_NAME = 'E2E User'

test.describe('Auth modal', () => {
  test('shows the auth modal on first load', async ({ page }) => {
    await page.goto('/')
    // Dialog role is present
    await expect(page.getByRole('dialog')).toBeVisible()
    // "Sign In" and "Register" tabs are visible
    await expect(page.getByRole('tab', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Register' })).toBeVisible()
  })

  test('shows a password validation error for short passwords', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByLabel(/password/i).fill('short')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible()
  })

  test('shows an email validation error for malformed emails', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email/i).fill('not-an-email')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/valid email/i)).toBeVisible()
  })
})

test.describe('Registration flow', () => {
  test('can register a new account and sees the main UI', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: 'Register' }).click()

    // Optional name field appears on register tab
    await expect(page.getByLabel(/name/i)).toBeVisible()

    await page.getByLabel(/name/i).fill(TEST_NAME)
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    // Password field — use more specific selector to avoid ambiguity with the label text
    await page.getByLabel(/^password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /create account/i }).click()

    // After successful registration the auth dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

    // The header should show the user name or email
    await expect(page.getByText(new RegExp(TEST_NAME, 'i'))).toBeVisible()
  })
})

test.describe('Login flow', () => {
  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/^password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    // Server will return an error
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 })
  })

  test('can log in with valid credentials', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/^password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Auth dialog closes on success
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  })
})

test.describe('Logout flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before testing logout
    await page.goto('/')
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/^password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  })

  test('log out button is visible after login', async ({ page }) => {
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
  })

  test('clicking log out shows the auth modal again', async ({ page }) => {
    await page.getByRole('button', { name: /log out/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
  })
})
