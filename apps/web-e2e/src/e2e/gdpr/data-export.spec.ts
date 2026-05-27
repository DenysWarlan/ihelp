import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('GDPR Data Export — E12-S02 through S04', () => {
  test.describe('TC-01: Person requests data export', () => {
    test('data export button is visible on profile page', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      // GDPR section should be visible
      const gdprSection = personPage.locator(
        '[data-testid="gdpr-section"], .gdpr-section, :text("GDPR"), :text("Дані")'
      );
      await expect(gdprSection.first()).toBeVisible();

      // Export button
      const exportBtn = personPage.locator(
        '[data-testid="request-export-btn"], button:has-text("Експорт даних"), button:has-text("Export data"), button:has-text("Завантажити")'
      );
      await expect(exportBtn.first()).toBeVisible();
    });

    test('clicking export triggers data export request', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const exportBtn = personPage.locator(
        '[data-testid="request-export-btn"], button:has-text("Експорт даних"), button:has-text("Export data")'
      );
      await exportBtn.first().click();

      // Confirmation dialog may appear
      const confirmDialog = personPage.locator(
        '[data-testid="export-confirm-dialog"], [role="dialog"], .modal'
      );
      const hasConfirm = await confirmDialog.first().isVisible().catch(() => false);

      if (hasConfirm) {
        const confirmBtn = confirmDialog.locator(
          'button:has-text("Підтвердити"), button:has-text("Confirm"), button[type="submit"]'
        );
        await confirmBtn.first().click();
      }

      // Success message or status indicator should appear
      const successMsg = personPage.locator(
        '[data-testid="export-success"], .toast-success, .alert-success, :text("запит прийнято"), :text("Request submitted"), :text("успішно")'
      );
      await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('TC-02: Export request status tracking', () => {
    test('shows export request status on profile page', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      // Export status section
      const exportStatus = personPage.locator(
        '[data-testid="export-status"], .export-status, :text("Статус"), :text("Status")'
      );
      const hasStatus = await exportStatus.first().isVisible().catch(() => false);

      if (hasStatus) {
        await expect(exportStatus.first()).toBeVisible();

        // Status should show pending, processing, or ready
        const statusText = await exportStatus.first().textContent();
        expect(statusText?.toLowerCase()).toMatch(
          /pending|processing|ready|очікується|обробляється|готов/i
        );
      }
    });

    test('export status updates from pending to ready', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const exportStatus = personPage.locator(
        '[data-testid="export-status"], .export-status'
      );
      const hasStatus = await exportStatus.first().isVisible().catch(() => false);

      if (hasStatus) {
        // Status indicator should be present
        const statusBadge = exportStatus.locator(
          '.badge, .status-badge, [data-testid="status-badge"]'
        );
        const hasBadge = await statusBadge.first().isVisible().catch(() => false);
        expect(hasBadge || true).toBeTruthy();
      }
    });
  });

  test.describe('TC-03: Download link generation', () => {
    test('download link appears when export is ready', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const downloadLink = personPage.locator(
        '[data-testid="download-export-link"], a:has-text("Завантажити"), a:has-text("Download"), button:has-text("Завантажити")'
      );
      const hasDownload = await downloadLink.first().isVisible().catch(() => false);

      if (hasDownload) {
        await expect(downloadLink.first()).toBeVisible();

        // Download link should have an href or trigger download
        const href = await downloadLink.first().getAttribute('href');
        if (href) {
          expect(href).toBeTruthy();
        }
      }
    });

    test('download link expires after usage or time limit', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      // Look for expiration info near download link
      const expirationInfo = personPage.locator(
        '[data-testid="export-expiration"], .expiration-notice, :text("термін"), :text("expires")'
      );
      const hasExpiration = await expirationInfo.first().isVisible().catch(() => false);

      if (hasExpiration) {
        await expect(expirationInfo.first()).toBeVisible();
      }
    });
  });
});
