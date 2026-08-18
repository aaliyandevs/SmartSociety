import { test as setup } from '@playwright/test';

import { ACCOUNTS, STORAGE_STATE, signIn, type AccountKey } from './helpers';

/**
 * Signs in once per role and saves the session cookie to disk.
 *
 * The other specs reuse that state instead of signing in again for every test.
 * This is not only faster — the application rate-limits sign-in attempts per
 * identifier (8 per 5 minutes), which a suite that logged in on every test
 * would legitimately trip. Reusing state exercises the app as a real user does:
 * sign in once, then work.
 */
for (const role of Object.keys(ACCOUNTS) as AccountKey[]) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await signIn(page, role);
    await page.context().storageState({ path: STORAGE_STATE[role] });
  });
}
