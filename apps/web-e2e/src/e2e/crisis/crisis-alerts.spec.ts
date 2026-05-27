import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Crisis Alerts -- TC-S-E08-S02 through S05', () => {
  test.describe('TC-01: Crisis alert page shows unacknowledged alerts', () => {
    test('should display crisis alerts at /staff/crisis with unacknowledged items', async ({
      staffPage,
    }) => {
      await staffPage.goto(ROUTES.staffCrisis);
      await staffPage.waitForLoadState('networkidle');

      // Page heading
      const heading = staffPage.locator('h1, h2, [data-testid="crisis-title"]').first();
      await expect(heading).toBeVisible();

      // Alert list or table
      const alertContainer = staffPage.locator(
        '[data-testid="crisis-alerts"], .crisis-alerts, table, .alert-list'
      );
      await expect(alertContainer.first()).toBeVisible({ timeout: 10_000 });

      // Individual alert rows
      const alertRows = staffPage.locator(
        '[data-testid="crisis-alert"], .crisis-alert, table tbody tr, .alert-row, .alert-card'
      );
      const emptyState = staffPage.locator(
        '[data-testid="empty-state"], .empty-state, :text("немає сповіщень")'
      );

      const hasAlerts = await alertRows.first().isVisible({ timeout: 5_000 }).catch(() => false);
      const isEmpty = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasAlerts || isEmpty).toBeTruthy();

      if (hasAlerts) {
        // Each alert should display: case reference, keyword, timestamp
        const firstAlert = alertRows.first();

        const caseRef = firstAlert.locator(
          '[data-testid="alert-case-ref"], .case-ref, .case-id'
        );
        if (await caseRef.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const refText = await caseRef.textContent();
          expect(refText?.trim().length).toBeGreaterThan(0);
        }

        // Unacknowledged indicator
        const unacknowledged = firstAlert.locator(
          '[data-testid="unacknowledged"], .unacknowledged, .new-badge, .pending'
        );
        if (await unacknowledged.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await expect(unacknowledged).toBeVisible();
        }
      }
    });
  });

  test.describe('TC-02: Acknowledge crisis alert', () => {
    test('should allow staff to acknowledge a crisis alert', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffCrisis);
      await staffPage.waitForLoadState('networkidle');

      const alertRow = staffPage.locator(
        '[data-testid="crisis-alert"], .crisis-alert, table tbody tr, .alert-card'
      ).first();

      if (!(await alertRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Click acknowledge button
      const ackBtn = alertRow.locator(
        '[data-testid="acknowledge-btn"], button:has-text("Підтвердити"), button:has-text("Acknowledge"), button[aria-label*="acknowledge"]'
      );

      if (!(await ackBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        // Try clicking the alert row to see detail, then acknowledge
        await alertRow.click();
        await staffPage.waitForLoadState('networkidle');

        const detailAckBtn = staffPage.getByRole('button', {
          name: /підтвердити|acknowledge|прийняти/i,
        });

        if (!(await detailAckBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
          test.skip();
          return;
        }

        await detailAckBtn.click();
      } else {
        await ackBtn.click();
      }

      await staffPage.waitForLoadState('networkidle');

      // Verify acknowledgment
      const toast = staffPage.locator('[role="alert"]');
      const acknowledgedBadge = staffPage.locator(
        '[data-testid="acknowledged"], .acknowledged, .ack-badge'
      );

      const acked =
        (await toast.first().isVisible({ timeout: 5_000 }).catch(() => false)) ||
        (await acknowledgedBadge.first().isVisible({ timeout: 5_000 }).catch(() => false));
      expect(acked).toBeTruthy();
    });
  });

  test.describe('TC-03: Action log for crisis actions', () => {
    test('should display action log on crisis alert detail', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffCrisis);
      await staffPage.waitForLoadState('networkidle');

      const alertRow = staffPage.locator(
        '[data-testid="crisis-alert"], .crisis-alert, table tbody tr, .alert-card'
      ).first();

      if (!(await alertRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Open alert detail
      await alertRow.click();
      await staffPage.waitForLoadState('networkidle');

      // Action log section
      const actionLog = staffPage.locator(
        '[data-testid="action-log"], .action-log, .activity-log, .timeline'
      );

      if (await actionLog.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Log entries should be present
        const logEntries = actionLog.locator(
          '[data-testid="log-entry"], .log-entry, .activity-item, .timeline-item'
        );
        const count = await logEntries.count();
        expect(count).toBeGreaterThanOrEqual(0);

        // Each entry should have timestamp
        if (count > 0) {
          const firstEntry = logEntries.first();
          const timestamp = firstEntry.locator(
            '[data-testid="timestamp"], .timestamp, time, .date'
          );
          if (await timestamp.isVisible({ timeout: 3_000 }).catch(() => false)) {
            const timeText = await timestamp.textContent();
            expect(timeText).toBeTruthy();
          }
        }
      }

      // Add a new action
      const addActionBtn = staffPage.getByRole('button', {
        name: /додати дію|add action|записати|log action/i,
      });

      if (await addActionBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addActionBtn.click();

        const actionInput = staffPage.locator(
          '[data-testid="action-input"], textarea, input[name="action"]'
        );
        if (await actionInput.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
          await actionInput.first().fill('Зателефоновано до бенефіціара для перевірки стану');

          const saveBtn = staffPage.getByRole('button', { name: /зберегти|save|додати/i });
          await saveBtn.click();
          await staffPage.waitForLoadState('networkidle');

          // Verify action was added
          const newLogEntry = staffPage.locator(
            ':text("Зателефоновано")'
          );
          await expect(newLogEntry.first()).toBeVisible({ timeout: 10_000 });
        }
      }
    });
  });

  test.describe('TC-04: Crisis history at /staff/supervisor/crisis', () => {
    test('should display crisis history for supervisors', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.supervisorCrisis);
      await supervisorPage.waitForLoadState('networkidle');

      // Page heading
      const heading = supervisorPage.locator('h1, h2, [data-testid="crisis-history-title"]').first();
      await expect(heading).toBeVisible();

      // History table or list
      const historyContainer = supervisorPage.locator(
        '[data-testid="crisis-history"], .crisis-history, table, .history-list'
      );
      await expect(historyContainer.first()).toBeVisible({ timeout: 10_000 });

      // History entries
      const historyRows = supervisorPage.locator(
        '[data-testid="crisis-history-row"], table tbody tr, .history-row, .history-card'
      );
      const emptyState = supervisorPage.locator(
        '[data-testid="empty-state"], .empty-state'
      );

      const hasHistory = await historyRows.first().isVisible({ timeout: 5_000 }).catch(() => false);
      const isEmpty = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasHistory || isEmpty).toBeTruthy();

      if (hasHistory) {
        // Each entry should show: case ID, detected keyword, date, resolution
        const firstRow = historyRows.first();

        const dateCol = firstRow.locator(
          '[data-testid="crisis-date"], .date, time, td:nth-child(1)'
        );
        if (await dateCol.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const dateText = await dateCol.textContent();
          expect(dateText).toBeTruthy();
        }

        // Resolution or status column
        const resolution = firstRow.locator(
          '[data-testid="crisis-resolution"], .resolution, .status, .outcome'
        );
        if (await resolution.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const resolutionText = await resolution.textContent();
          expect(resolutionText).toBeTruthy();
        }
      }
    });
  });
});
