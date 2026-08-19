import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * Shared helpers for the end-to-end suite.
 *
 * These credentials are the seeded demo accounts documented in the README.
 */
export const ACCOUNTS = {
  admin: { email: 'admin@smartsociety.local', password: 'Admin@12345', home: '/admin' },
  resident: { email: 'resident@smartsociety.local', password: 'Resident@12345', home: '/resident' },
  guard: { email: 'guard@smartsociety.local', password: 'Guard@12345', home: '/guard' },
  staff: {
    email: 'maintenance@smartsociety.local',
    password: 'Maintenance@12345',
    home: '/staff',
  },
} as const;

export type AccountKey = keyof typeof ACCOUNTS;

/** Where `auth.setup.ts` saves each role's signed-in state. */
const AUTH_DIR = path.join(__dirname, '.auth');

export const STORAGE_STATE: Record<AccountKey, string> = {
  admin: path.join(AUTH_DIR, 'admin.json'),
  resident: path.join(AUTH_DIR, 'resident.json'),
  guard: path.join(AUTH_DIR, 'guard.json'),
  staff: path.join(AUTH_DIR, 'staff.json'),
};

/** Signs in through the real login form and waits for the role dashboard. */
export async function signIn(page: Page, account: AccountKey) {
  const { email, password, home } = ACCOUNTS[account];

  await page.goto('/login');
  await page.getByLabel('Email or username').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  await page.waitForURL(new RegExp(`${home}(/|$)`), { timeout: 30_000 });
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);
}

/** Waits for a Sonner toast whose text matches. */
export async function expectToast(page: Page, pattern: RegExp) {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: pattern }).first()).toBeVisible({
    timeout: 15_000,
  });
}
