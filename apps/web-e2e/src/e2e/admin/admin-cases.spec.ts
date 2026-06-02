import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Admin Cases Overview', () => {
  const ADMIN_CASES_URL = `${ROUTES.adminDashboard}/cases`;

  test.describe('TC-01: Admin can access cases page', () => {
    test('admin navigates to cases page and sees heading', async ({ adminPage }) => {
      await adminPage.goto(ADMIN_CASES_URL);
      await adminPage.waitForLoadState('networkidle');

      const heading = adminPage.locator('h1, [data-testid="admin-cases-title"]');
      await expect(heading.first()).toBeVisible({ timeout: 15_000 });
    });

    test('non-admin cannot access admin cases page', async ({ staffPage }) => {
      await staffPage.goto(ADMIN_CASES_URL);
      await staffPage.waitForLoadState('networkidle');

      // Should be redirected away or see an access denied
      const url = staffPage.url();
      expect(url).not.toContain('/admin/cases');
    });
  });

  test.describe('TC-02: Stat cards display and filter', () => {
    test('stat cards show total, waiting, active, resolved counts', async ({ adminPage }) => {
      await adminPage.goto(ADMIN_CASES_URL);
      await adminPage.waitForLoadState('networkidle');

      const statCards = adminPage.locator(
        '.admin-cases__stat-card, [data-testid="stat-card"]',
      );
      await expect(statCards.first()).toBeVisible({ timeout: 15_000 });

      const count = await statCards.count();
      expect(count).toBe(4); // Total, Waiting, Active, Resolved
    });

    test('clicking a stat card filters the table', async ({ adminPage }) => {
      await adminPage.goto(ADMIN_CASES_URL);
      await adminPage.waitForLoadState('networkidle');

      const statCards = adminPage.locator(
        '.admin-cases__stat-card, [data-testid="stat-card"]',
      );
      await expect(statCards.first()).toBeVisible({ timeout: 15_000 });

      // Click the "Waiting" stat card (second card)
      await statCards.nth(1).click();

      // Verify the card becomes active
      await expect(statCards.nth(1)).toHaveClass(/--active/);

      // Click the same card again to clear filter
      await statCards.nth(1).click();
      await expect(statCards.nth(1)).not.toHaveClass(/--active/);
    });
  });

  test.describe('TC-03: Search functionality', () => {
    test('search input is visible and accepts text', async ({ adminPage }) => {
      await adminPage.goto(ADMIN_CASES_URL);
      await adminPage.waitForLoadState('networkidle');

      const searchInput = adminPage.locator(
        '.admin-cases__search-input, input[type="text"]',
      );
      await expect(searchInput.first()).toBeVisible({ timeout: 15_000 });
      await searchInput.first().fill('test query');

      await expect(searchInput.first()).toHaveValue('test query');
    });
  });

  test.describe('TC-04: Cases table display', () => {
    test('table shows required columns', async ({ adminPage }) => {
      await adminPage.goto(ADMIN_CASES_URL);
      await adminPage.waitForLoadState('networkidle');

      const table = adminPage.locator(
        '.admin-cases__table, table, [data-testid="cases-table"]',
      );

      // Wait for either table or empty/loading state
      const hasTable = await table.first().isVisible({ timeout: 15_000 }).catch(() => false);

      if (hasTable) {
        // Verify column headers exist
        const headers = table.locator('th');
        const headerCount = await headers.count();
        expect(headerCount).toBeGreaterThanOrEqual(5); // name, consultant, topic, status, priority, date
      }
    });

    test('clicking a case row navigates to case detail', async ({ adminPage }) => {
      await adminPage.goto(ADMIN_CASES_URL);
      await adminPage.waitForLoadState('networkidle');

      const row = adminPage.locator(
        '.admin-cases__row, table tbody tr, [data-testid="case-row"]',
      );

      const hasRows = await row.first().isVisible({ timeout: 15_000 }).catch(() => false);

      if (hasRows) {
        await row.first().click();

        // Should navigate to case detail
        await adminPage.waitForURL(/\/staff\/cases\//);
      }
    });
  });

  test.describe('TC-05: Admin dashboard has cases nav card', () => {
    test('admin dashboard shows cases navigation card', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      const casesLink = adminPage.locator(
        'a[href*="admin/cases"], [data-testid="admin-cases-link"]',
      );
      await expect(casesLink.first()).toBeVisible({ timeout: 15_000 });
    });

    test('clicking cases card navigates to admin cases', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      const casesLink = adminPage.locator(
        'a[href*="admin/cases"], [data-testid="admin-cases-link"]',
      );
      await casesLink.first().click();

      await adminPage.waitForURL(/admin\/cases/);
    });
  });
});
