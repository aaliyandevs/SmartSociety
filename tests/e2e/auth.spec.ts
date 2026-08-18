import { expect, test } from '@playwright/test';

import { ACCOUNTS, signIn, signOut } from './helpers';

test.describe('authentication and authorisation', () => {
  // This spec exercises the sign-in flow itself, so it must start signed out.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the landing page renders with the required sitemap', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('housing society');
    await expect(page.locator('#sitemap')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Every screen in the application' })).toBeVisible();

    // The sitemap lists all four role areas.
    for (const area of ['Administrator', 'Resident', 'Security guard', 'Maintenance staff']) {
      await expect(page.locator('#sitemap').getByText(area, { exact: true }).first()).toBeVisible();
    }
  });

  test('an unauthenticated visitor is redirected to sign in', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  });

  test('a wrong password is refused with a generic message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email or username').fill(ACCOUNTS.admin.email);
    await page.getByLabel('Password', { exact: true }).fill('DefinitelyWrong1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email/username or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe('each role reaches its own dashboard', () => {
    for (const [key, account] of Object.entries(ACCOUNTS)) {
      test(`${key} signs in`, async ({ page }) => {
        await signIn(page, key as keyof typeof ACCOUNTS);
        await expect(page).toHaveURL(new RegExp(account.home));
      });
    }
  });

  test('a resident cannot open the administrator area', async ({ page }) => {
    await signIn(page, 'resident');
    await page.goto('/admin/bills');
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByText('You do not have access to this area')).toBeVisible();
  });

  test('a guard cannot open the administrator area', async ({ page }) => {
    await signIn(page, 'guard');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/unauthorized/);
  });

  test('signing out clears the session', async ({ page }) => {
    await signIn(page, 'resident');
    await signOut(page);

    await page.goto('/resident');
    await expect(page).toHaveURL(/\/login/);
  });
});
