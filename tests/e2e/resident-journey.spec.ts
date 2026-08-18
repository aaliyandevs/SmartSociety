import { expect, test } from '@playwright/test';

import { STORAGE_STATE, expectToast } from './helpers';

/**
 * The resident journey the SRS describes:
 * Login → generate a visitor pass → view the monthly bill → book the clubhouse
 * → log a plumbing ticket → track its SLA.
 *
 * The sign-in step itself is covered in auth.spec.ts; here the saved resident
 * session is reused so each test starts where a signed-in resident would.
 */
test.describe('resident journey', () => {
  test.use({ storageState: STORAGE_STATE.resident });

  test('generates a visitor gate pass with a QR code and a gate code', async ({ page }) => {
    await page.goto('/resident/visitors/new');

    await page.getByRole('button', { name: /Guest/ }).first().click();
    await page.getByLabel('Visitor name').fill('E2E Test Visitor');
    await page.getByLabel('Mobile number').fill('03001234561');
    await page.getByLabel('Purpose of visit').fill('End-to-end test visit');

    await page.getByRole('button', { name: 'Create pass' }).click();

    // Lands on the pass detail page. The negative lookahead matters: without it
    // the pattern also matches /resident/visitors/new and passes immediately.
    await page.waitForURL(/\/resident\/visitors\/(?!new)[\w-]+$/, { timeout: 30_000 });
    await expect(page.getByText('Show this at the gate')).toBeVisible();

    // A six-digit gate code and a rendered QR image are both present.
    await expect(page.getByText(/^\d{6}$/)).toBeVisible();
    await expect(page.getByRole('img', { name: /QR gate pass/ })).toBeVisible();
    await expect(page.getByText('E2E Test Visitor').first()).toBeVisible();
  });

  test('views the current bill with its charge breakdown', async ({ page }) => {
    await page.goto('/resident/bills');
    await expect(page.getByRole('heading', { name: 'Maintenance bills' })).toBeVisible();

    // Open the newest invoice.
    await page.getByRole('link', { name: /^(Pay|View)$/ }).first().click();
    await page.waitForURL(/\/resident\/bills\/[a-z0-9]+/);

    await expect(page.getByText('Charge breakdown')).toBeVisible();
    await expect(page.getByText('Monthly maintenance')).toBeVisible();
    await expect(page.getByText('Total payable')).toBeVisible();
  });

  test('books an amenity and sees it in upcoming bookings', async ({ page }) => {
    await page.goto('/resident/amenities');
    await expect(page.getByRole('heading', { name: 'Amenity booking' })).toBeVisible();

    // The amenity and date are URL state, so navigate straight to a day far
    // enough out that a free slot is guaranteed. This is exactly the URL the
    // date picker produces.
    const target = new Date();
    target.setDate(target.getDate() + 9);
    const date = target.toISOString().slice(0, 10);
    await page.goto(`/resident/amenities?amenity=gymnasium&date=${date}`);

    await expect(page.getByRole('heading', { name: 'Gymnasium' })).toBeVisible();

    // Pick the first slot that is still selectable.
    const slot = page
      .locator('button:not([disabled])')
      .filter({ hasText: /^\d{2}:\d{2} (AM|PM)/ })
      .first();
    await expect(slot).toBeVisible();
    await slot.click();

    const submit = page.getByRole('button', { name: /Confirm booking|Request booking/ });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expectToast(page, /booked|Request submitted/i);

    // The reservation now appears under upcoming bookings.
    await expect(page.getByText('Upcoming bookings')).toBeVisible();
    await expect(page.locator('li').filter({ hasText: 'Gymnasium' }).first()).toBeVisible();
  });

  test('raises a plumbing ticket and can track its SLA', async ({ page }) => {
    await page.goto('/resident/complaints/new');

    await page.getByLabel('What is the problem?').fill('E2E plumbing check — tap dripping');
    await page.getByLabel('Where exactly?').fill('Guest bathroom');
    await page
      .getByLabel('Describe the problem')
      .fill('The wash basin tap keeps dripping even when fully closed. Raised by the end-to-end test.');
    // The priority buttons carry a hint line, so match on the leading label.
    await page.getByRole('button', { name: /^High/ }).click();

    await page.getByRole('button', { name: 'Raise the ticket' }).click();

    await page.waitForURL(/\/resident\/complaints\/(?!new)[\w-]+$/, { timeout: 30_000 });
    await expect(page.getByText('E2E plumbing check — tap dripping')).toBeVisible();

    // The SLA panel is the "track SLA" step of the journey.
    await expect(page.getByText('Service level')).toBeVisible();
    await expect(page.getByText(/On track|Due soon|SLA breached/)).toBeVisible();
    await expect(page.getByText('Waiting for assignment')).toBeVisible();
  });

  test('reads the notice board and the society guidelines', async ({ page }) => {
    await page.goto('/resident/notices');
    await expect(page.getByRole('heading', { name: 'Notice board' })).toBeVisible();
    await page.getByRole('link').filter({ hasText: /Annual General Body Meeting/ }).first().click();
    await expect(page.getByText(/agenda/i).first()).toBeVisible();

    await page.goto('/resident/guidelines');
    // The page heading and the rulebook's own "Society Guidelines" heading both
    // match, so take the page-level one.
    await expect(page.getByRole('heading', { name: 'Society guidelines', level: 1 })).toBeVisible();
    await expect(page.getByText('Maintenance dues').first()).toBeVisible();
  });

  test('votes once and cannot vote again in the same poll', async ({ page }) => {
    await page.goto('/resident/polls');
    await expect(page.getByRole('heading', { name: 'Polls & voting' })).toBeVisible();

    // Find a poll that still offers a ballot, and remember which one it is —
    // the page shows several polls, so the assertions must stay scoped to this
    // one card rather than to the page.
    const openCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole('button', { name: 'Cast my vote' }) })
      .first();

    let pollTitle: string;

    if ((await openCard.count()) > 0) {
      pollTitle = (await openCard.locator('[data-slot="card-title"]').first().innerText()).trim();

      await openCard.locator('button[aria-pressed]').first().click();
      await openCard.getByRole('button', { name: 'Cast my vote' }).click();
      await expectToast(page, /vote for .* has been recorded/i);
      await page.reload();
    } else {
      // Already voted everywhere (a previous run) — assert against a voted poll.
      const votedCard = page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByText('Voted', { exact: true }) })
        .first();
      pollTitle = (await votedCard.locator('[data-slot="card-title"]').first().innerText()).trim();
    }

    // That specific poll now shows the resident as having voted, and offers no
    // second ballot — duplicate voting is impossible.
    const card = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(pollTitle, { exact: true }) })
      .first();

    await expect(card.getByText('Voted', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Cast my vote' })).toHaveCount(0);
  });
});
