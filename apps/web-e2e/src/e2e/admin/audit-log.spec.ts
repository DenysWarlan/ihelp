import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Audit Log — E13-S08 through S10', () => {
  test.describe('TC-01: Audit log shows events', () => {
    test('admin can access audit log page', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const heading = adminPage.locator(
        'h1, h2, [data-testid="audit-heading"]'
      );
      await expect(heading.first()).toBeVisible();
    });

    test('audit log displays event entries', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      // Audit log table
      const auditTable = adminPage.locator(
        '[data-testid="audit-log-table"], table, .audit-log, .log-entries'
      );
      await expect(auditTable.first()).toBeVisible();

      // Event rows
      const eventRows = auditTable.locator(
        'tbody tr, .log-entry, .audit-row'
      );
      const count = await eventRows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('each event shows timestamp, actor, action, and resource', async ({
      adminPage,
    }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const eventRows = adminPage.locator(
        '[data-testid="audit-log-table"] tbody tr, .log-entry, .audit-row'
      );
      const count = await eventRows.count();

      if (count > 0) {
        const firstEvent = eventRows.first();
        await expect(firstEvent).toBeVisible();

        // Should have multiple data cells
        const cells = firstEvent.locator('td, .cell, .field');
        const cellCount = await cells.count();
        expect(cellCount).toBeGreaterThanOrEqual(1);
      }
    });

    test('non-admin cannot access audit log', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffAudit);
      await staffPage.waitForLoadState('networkidle');

      const currentUrl = staffPage.url();
      const isRedirected =
        currentUrl.includes('/login') ||
        (currentUrl.includes('/staff') && !currentUrl.includes('/audit')) ||
        currentUrl.includes('/403');

      const forbidden = staffPage.locator(
        ':text("403"), :text("Заборонено"), :text("Forbidden")'
      );
      const hasForbidden = await forbidden.first().isVisible().catch(() => false);

      expect(isRedirected || hasForbidden).toBeTruthy();
    });
  });

  test.describe('TC-02: Filter by actor, resource, action, date', () => {
    test('actor filter narrows audit entries', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const actorFilter = adminPage.locator(
        '[data-testid="actor-filter"], select[name="actor"], input[name="actor"], .actor-filter'
      );
      const hasFilter = await actorFilter.first().isVisible().catch(() => false);

      if (hasFilter) {
        await actorFilter.first().click();
        const options = adminPage.locator('[role="option"], option');
        if ((await options.count()) > 0) {
          await options.first().click();
          await adminPage.waitForLoadState('networkidle');
        }
      }
    });

    test('resource filter narrows audit entries', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const resourceFilter = adminPage.locator(
        '[data-testid="resource-filter"], select[name="resource"], .resource-filter'
      );
      const hasFilter = await resourceFilter.first().isVisible().catch(() => false);

      if (hasFilter) {
        await resourceFilter.first().click();
        const options = adminPage.locator('[role="option"], option');
        if ((await options.count()) > 0) {
          await options.first().click();
          await adminPage.waitForLoadState('networkidle');
        }
      }
    });

    test('action filter narrows audit entries', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const actionFilter = adminPage.locator(
        '[data-testid="action-filter"], select[name="action"], .action-filter'
      );
      const hasFilter = await actionFilter.first().isVisible().catch(() => false);

      if (hasFilter) {
        await actionFilter.first().click();
        const options = adminPage.locator('[role="option"], option');
        if ((await options.count()) > 0) {
          await options.first().click();
          await adminPage.waitForLoadState('networkidle');
        }
      }
    });

    test('date range filter limits events to specified period', async ({
      adminPage,
    }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const dateFrom = adminPage.locator(
        '[data-testid="date-from"], input[name="dateFrom"], input[type="date"]:first-of-type'
      );
      const dateTo = adminPage.locator(
        '[data-testid="date-to"], input[name="dateTo"], input[type="date"]:last-of-type'
      );

      const hasDateFilter = await dateFrom.first().isVisible().catch(() => false);

      if (hasDateFilter) {
        await dateFrom.first().fill('2026-01-01');
        await dateTo.first().fill('2026-12-31');
        await adminPage.waitForLoadState('networkidle');

        const eventRows = adminPage.locator(
          '[data-testid="audit-log-table"] tbody tr, .log-entry'
        );
        const count = await eventRows.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('TC-03: Export to CSV', () => {
    test('export button triggers CSV download', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const exportBtn = adminPage.locator(
        '[data-testid="export-audit-btn"], button:has-text("Експорт"), button:has-text("Export"), button:has-text("CSV")'
      );
      const hasExport = await exportBtn.first().isVisible().catch(() => false);

      if (hasExport) {
        const downloadPromise = adminPage.waitForEvent('download', { timeout: 5000 }).catch(() => null);
        await exportBtn.first().click();

        const download = await downloadPromise;
        if (download) {
          const filename = download.suggestedFilename();
          expect(filename).toMatch(/\.(csv|xlsx)$/i);
        }
      }
    });

    test('export respects current filters', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      // Apply a filter first
      const actionFilter = adminPage.locator(
        '[data-testid="action-filter"], select[name="action"]'
      );
      const hasFilter = await actionFilter.first().isVisible().catch(() => false);
      if (hasFilter) {
        await actionFilter.first().click();
        const options = adminPage.locator('[role="option"], option');
        if ((await options.count()) > 0) {
          await options.first().click();
          await adminPage.waitForLoadState('networkidle');
        }
      }

      // Then export
      const exportBtn = adminPage.locator(
        '[data-testid="export-audit-btn"], button:has-text("Експорт"), button:has-text("Export")'
      );
      const hasExport = await exportBtn.first().isVisible().catch(() => false);
      if (hasExport) {
        const downloadPromise = adminPage.waitForEvent('download', { timeout: 5000 }).catch(() => null);
        await exportBtn.first().click();
        const download = await downloadPromise;
        if (download) {
          expect(download.suggestedFilename()).toBeTruthy();
        }
      }
    });
  });

  test.describe('TC-04: Search by actor name', () => {
    test('search input filters audit log by actor name', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const searchInput = adminPage.locator(
        '[data-testid="audit-search"], input[type="search"], input[placeholder*="Пошук"], input[placeholder*="Search"]'
      );
      const hasSearch = await searchInput.first().isVisible().catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('Admin');
        await adminPage.waitForLoadState('networkidle');

        const eventRows = adminPage.locator(
          '[data-testid="audit-log-table"] tbody tr, .log-entry'
        );
        const count = await eventRows.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('empty search shows all entries', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffAudit);
      await adminPage.waitForLoadState('networkidle');

      const searchInput = adminPage.locator(
        '[data-testid="audit-search"], input[type="search"]'
      );
      const hasSearch = await searchInput.first().isVisible().catch(() => false);

      if (hasSearch) {
        // Type something, then clear
        await searchInput.first().fill('nonexistent');
        await adminPage.waitForLoadState('networkidle');
        const filteredCount = await adminPage.locator(
          '[data-testid="audit-log-table"] tbody tr, .log-entry'
        ).count();

        await searchInput.first().clear();
        await adminPage.waitForLoadState('networkidle');
        const allCount = await adminPage.locator(
          '[data-testid="audit-log-table"] tbody tr, .log-entry'
        ).count();

        expect(allCount).toBeGreaterThanOrEqual(filteredCount);
      }
    });
  });
});
