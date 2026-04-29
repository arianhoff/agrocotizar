/**
 * auth.setup.ts
 * Runs once before the review suite. Logs in and saves the browser session
 * so review tests don't have to re-authenticate.
 *
 * Requires env vars:
 *   E2E_EMAIL    – your Cotizagro email
 *   E2E_PASSWORD – your password
 *
 * Usage:
 *   $env:E2E_EMAIL="tu@email.com"; $env:E2E_PASSWORD="tupassword"
 *   npx playwright test --ui
 */
import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'tests/.auth/state.json'

setup('login and save session', async ({ page }) => {
  const email    = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  if (!email || !password) {
    throw new Error(
      'Missing E2E_EMAIL or E2E_PASSWORD env vars.\n' +
      'Run: $env:E2E_EMAIL="tu@email.com"; $env:E2E_PASSWORD="tupassword"'
    )
  }

  await setup.step('Abrir landing page', async () => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Iniciar sesión' }).first()).toBeVisible({ timeout: 10_000 })
  })

  await setup.step('Ir al login', async () => {
    await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
    await expect(page.getByPlaceholder('Email')).toBeVisible({ timeout: 8_000 })
  })

  await setup.step('Ingresar credenciales', async () => {
    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Contraseña').fill(password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
  })

  await setup.step('Esperar dashboard', async () => {
    // Wait for the AppLayout sidebar to appear — confirms successful login
    await expect(page.locator('nav, [class*="sidebar"], [class*="AppLayout"]').first()).toBeVisible({ timeout: 15_000 })
  })

  await page.context().storageState({ path: AUTH_FILE })
  console.log(`✅ Session saved to ${AUTH_FILE}`)
})
