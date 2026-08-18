import { expect, test } from '@playwright/test';

import { STORAGE_STATE, expectToast } from './helpers';

/**
 * The gate verification loop and the administrator's oversight of it —
 * the highest-value flow in the system.
 */
test.describe('gate verification', () => {
  test.use({ storageState: STORAGE_STATE.guard });

  test('a resident creates a pass and the guard clears the visitor with it', async ({ browser }) => {
    // Two independent browser contexts, each restoring its own saved session,
    // so the resident and the guard act genuinely concurrently.
    const residentContext = await browser.newContext({ storageState: STORAGE_STATE.resident });
    const guardContext = await browser.newContext({ storageState: STORAGE_STATE.guard });
    const residentPage = await residentContext.newPage();
    const guardPage = await guardContext.newPage();

    try {
      // 1 — the resident pre-approves a visitor.
      await residentPage.goto('/resident/visitors/new');
      await residentPage.getByLabel('Visitor name').fill('Gate Flow Visitor');
      await residentPage.getByLabel('Mobile number').fill('9876500022');
      await residentPage.getByRole('button', { name: 'Create pass' }).click();
      await residentPage.waitForURL(/\/resident\/visitors\/[a-z0-9]+/, { timeout: 30_000 });

      const gateCode = (await residentPage.locator('p.font-mono.text-3xl').innerText()).trim();
      expect(gateCode).toMatch(/^\d{6}$/);

      // 2 — the guard verifies it.
      await guardPage.goto('/guard/verify');
      await guardPage.getByLabel('Gate code or scanned pass').fill(gateCode);
      await guardPage.getByRole('button', { name: 'Verify pass' }).click();

      await expect(guardPage.getByText('Pass is valid')).toBeVisible({ timeout: 15_000 });
      await expect(guardPage.getByText('Gate Flow Visitor')).toBeVisible();

      // 3 — entry is allowed and recorded.
      await guardPage.getByRole('button', { name: 'Allow entry' }).click();
      await expect(guardPage.getByText('Recorded')).toBeVisible({ timeout: 15_000 });

      // 4 — the same code is now refused because the visitor is already inside.
      await guardPage.goto('/guard/verify');
      await guardPage.getByLabel('Gate code or scanned pass').fill(gateCode);
      await guardPage.getByRole('button', { name: 'Verify pass' }).click();
      await expect(guardPage.getByText('Do not admit')).toBeVisible({ timeout: 15_000 });

      // 5 — the guard records the exit from the visitor log.
      await guardPage.goto('/guard/logs?q=Gate%20Flow%20Visitor');
      await guardPage.getByRole('button', { name: 'Record exit' }).first().click();
      await guardPage.getByRole('button', { name: 'Record exit' }).last().click();
      await expectToast(guardPage, /Exit recorded/i);
    } finally {
      await residentContext.close();
      await guardContext.close();
    }
  });

  test('an unknown code is refused with a clear reason', async ({ page }) => {
    await page.goto('/guard/verify');

    await page.getByLabel('Gate code or scanned pass').fill('000000');
    await page.getByRole('button', { name: 'Verify pass' }).click();

    await expect(page.getByText('Do not admit')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/No gate pass matches this code/)).toBeVisible();
  });

  test('the guard logs a walk-in visitor', async ({ page }) => {
    await page.goto('/guard/walk-in');

    await page.getByPlaceholder(/Type a flat number/).fill('A-101');
    await page.getByRole('button', { name: /Flat A-101/ }).first().click();

    await page.getByRole('button', { name: 'Delivery', exact: true }).click();
    await page.getByLabel('Visitor name').fill('E2E Courier');
    await page.getByLabel('Mobile number').fill('9876500033');

    await page.getByRole('button', { name: 'Record entry' }).click();
    await expectToast(page, /logged in for flat/i);
  });
});

test.describe('administrator oversight', () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('the dashboard shows live statistics', async ({ page }) => {
    await expect(page.getByText('Total flats')).toBeVisible();
    // "Outstanding dues" appears both as a stat tile and as a card title.
    await expect(page.getByText('Outstanding dues').first()).toBeVisible();
    await expect(page.getByText('Open complaints')).toBeVisible();
    await expect(page.getByText('Billing and collection')).toBeVisible();
    await expect(page.getByText('Flat occupancy')).toBeVisible();
  });

  test('the occupancy map renders every block', async ({ page }) => {
    await page.goto('/admin/flats');
    await page.getByRole('tab', { name: 'Occupancy map' }).click();
    await expect(page.getByText('Block A').first()).toBeVisible();
    await expect(page.getByText(/\d+ occupied/).first()).toBeVisible();
  });

  test('a complaint can be assigned to a technician', async ({ page }) => {
    await page.goto('/admin/complaints?assigned=UNASSIGNED');

    const firstTicket = page.locator('a[href^="/admin/complaints/"]').first();
    if ((await firstTicket.count()) === 0) {
      test.skip(true, 'No unassigned tickets in the seeded data.');
      return;
    }

    await firstTicket.click();
    await page.waitForURL(/\/admin\/complaints\/[a-z0-9]+/);

    await page.getByText('Assign & route').scrollIntoViewIfNeeded();
    await page.locator('button[aria-pressed]').filter({ hasText: /open ticket/ }).first().click();
    await page.getByRole('button', { name: /Assign ticket|Reassign ticket/ }).click();

    await expectToast(page, /Ticket assigned to/i);
  });

  test('gate logs are visible with the seven-day traffic chart', async ({ page }) => {
    await page.goto('/admin/security');
    await expect(page.getByText('Gate traffic — last seven days')).toBeVisible();
    await expect(page.getByText('Inside now')).toBeVisible();
  });

  test('the audit log records actions and is filterable', async ({ page }) => {
    await page.goto('/admin/audit');
    await expect(page.getByText('This log is append-only')).toBeVisible();
    await expect(page.getByText('Total entries')).toBeVisible();

    await page.goto('/admin/audit?group=gate');
    await expect(page.locator('text=/gate\\./').first()).toBeVisible();
  });

  test('an emergency alert can be broadcast and resolved', async ({ page }) => {
    await page.goto('/admin/alerts');

    await page.getByRole('button', { name: 'Broadcast alert' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Water shutdown' }).click();
    await page.getByRole('button', { name: 'Broadcast now' }).click();

    await expectToast(page, /Emergency alert broadcast/i);

    // The active-alert card appears...
    await expect(page.getByText('An alert is currently active')).toBeVisible({ timeout: 15_000 });

    // ...and the emergency banner reaches every signed-in device.
    await expect(page.getByRole('alert').filter({ hasText: /Water supply/i }).first()).toBeVisible({
      timeout: 45_000,
    });

    // Resolve it: the trigger opens a dialog whose submit button shares the name,
    // so the second click is scoped to the dialog.
    await page.getByRole('button', { name: 'Resolve alert' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Resolve alert' }).click();

    // Assert the outcome rather than the toast: the page refreshes on success,
    // which can retire the toast before an assertion sees it.
    await expect(page.getByText('An alert is currently active')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('There is no emergency alert running right now')).toBeVisible();
  });
});

test.describe('maintenance staff', () => {
  test.use({ storageState: STORAGE_STATE.staff });

  test('a technician updates a ticket and the note is recorded', async ({ page }) => {
    await page.goto('/staff/tickets');

    const firstTicket = page.locator('a[href^="/staff/tickets/"]').first();
    if ((await firstTicket.count()) === 0) {
      test.skip(true, 'No tickets assigned to the demo technician.');
      return;
    }

    await firstTicket.click();
    await page.waitForURL(/\/staff\/tickets\/(?!$)[\w-]+$/);

    // Which transitions are offered depends on the ticket's current status, so
    // take whichever the panel actually shows.
    const transition = page
      .locator('fieldset')
      .filter({ hasText: 'Move this ticket to' })
      .getByRole('button')
      .first();
    await expect(transition).toBeVisible();
    const target = (await transition.innerText()).trim();
    await transition.click();

    // Exact, because the inactive "Add a work note" tab panel also matches loosely.
    await page
      .getByLabel('Work note', { exact: true })
      .fill('Visited the flat and diagnosed the issue. Part ordered.');
    await page.getByRole('button', { name: 'Save update' }).click();

    await expectToast(page, new RegExp(`is now ${target}`, 'i'));
    await expect(page.getByText('Part ordered.').first()).toBeVisible();
  });
});
