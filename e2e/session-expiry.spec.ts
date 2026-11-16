import { expect, test } from './fixtures'
import { DEMO_EMAIL, DEMO_PASSWORD, signInFresh } from './helpers'

const PROFILE_ROUTE = '**/api/auth/profile'

/**
 * The session-expiry path is the reason the in-place sign-in dialog exists:
 * a blocking redirect to /login would throw away the form the user was editing.
 *
 * First PATCH answers 401 (token expired), so:
 * 1. the app keeps /settings mounted and opens the dialog;
 * 2. the typed name is still there;
 * 3. after signing in the dialog resumes the same save, which then succeeds.
 */
test('an expired session keeps the page and resumes the interrupted save', async ({
  page,
  api,
}) => {
  await signInFresh(page)
  await page.goto('/settings')

  let attempts = 0
  await api.mock(PROFILE_ROUTE, () => {
    attempts += 1

    if (attempts === 1) {
      return { status: 401, body: { message: 'Session expired' } }
    }

    return { body: { user: { id: 'demo-user', name: 'Session Hero', email: DEMO_EMAIL } } }
  })

  const nameInput = page.locator('#account-name')
  await nameInput.fill('Session Hero')
  await page.getByRole('button', { name: '保存名称' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('登录状态已失效')).toBeVisible()

  // The point of the dialog: same URL, same form state.
  await expect(page).toHaveURL(/\/settings$/)
  await expect(nameInput).toHaveValue('Session Hero')

  await dialog.getByLabel('邮箱').fill(DEMO_EMAIL)
  await dialog.getByLabel('密码', { exact: true }).fill(DEMO_PASSWORD)
  await dialog.getByRole('button', { name: '登录并继续' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('账号名称已保存')).toBeVisible()
  expect(attempts).toBe(2)
})

test('a visitor still gets the full-page sign-in wall', async ({ page }) => {
  await page.goto('/tasks')

  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: '登录 Orbit' })).toBeVisible()
})
