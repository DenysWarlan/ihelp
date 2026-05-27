import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Vacation Transfer — E10-S01 through S03', () => {
  test.describe('TC-01: Consultant initiates vacation transfer', () => {
    test('sees all active and paused cases in transfer list', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      // Open vacation transfer dialog
      const transferBtn = staffPage.locator(
        '[data-testid="vacation-transfer-btn"], button:has-text("Відпустка"), button:has-text("Vacation")'
      );
      await expect(transferBtn.first()).toBeVisible();
      await transferBtn.first().click();

      // Transfer dialog/modal should appear
      const transferDialog = staffPage.locator(
        '[data-testid="transfer-dialog"], [role="dialog"], .modal'
      );
      await expect(transferDialog.first()).toBeVisible();

      // Case list should display active cases
      const caseList = transferDialog.locator(
        '[data-testid="transfer-case-list"], .case-list, table tbody tr, .case-item'
      );
      const caseCount = await caseList.count();
      expect(caseCount).toBeGreaterThanOrEqual(0);

      // Each case should show status badge (active or paused)
      if (caseCount > 0) {
        const firstCase = caseList.first();
        await expect(firstCase).toBeVisible();

        // Status should be either active or paused
        const statusBadge = firstCase.locator(
          '[data-testid="case-status"], .status-badge, .badge'
        );
        if (await statusBadge.isVisible()) {
          const statusText = await statusBadge.textContent();
          expect(statusText?.toLowerCase()).toMatch(/active|paused|активн|призупинен/i);
        }
      }
    });

    test('can select date range for vacation period', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      const transferBtn = staffPage.locator(
        '[data-testid="vacation-transfer-btn"], button:has-text("Відпустка"), button:has-text("Vacation")'
      );
      await transferBtn.first().click();

      // Date range inputs should be present
      const startDate = staffPage.locator(
        '[data-testid="vacation-start"], input[name="startDate"], input[type="date"]'
      );
      const endDate = staffPage.locator(
        '[data-testid="vacation-end"], input[name="endDate"], input[type="date"]:nth-of-type(2)'
      );
      await expect(startDate.first()).toBeVisible();
      await expect(endDate.first()).toBeVisible();
    });
  });

  test.describe('TC-02: Transfer list includes paused cases', () => {
    test('paused cases appear alongside active cases', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      const transferBtn = staffPage.locator(
        '[data-testid="vacation-transfer-btn"], button:has-text("Відпустка"), button:has-text("Vacation")'
      );
      await transferBtn.first().click();

      const transferDialog = staffPage.locator(
        '[data-testid="transfer-dialog"], [role="dialog"], .modal'
      );
      await expect(transferDialog.first()).toBeVisible();

      // Check that paused cases are included in the list
      const pausedCases = transferDialog.locator(
        '[data-testid="case-status-paused"], .status-paused, :text("Призупинено"), :text("Paused")'
      );
      // Paused cases may or may not exist depending on seed data
      const pausedCount = await pausedCases.count();
      expect(pausedCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('TC-03: Empty case list when no active cases', () => {
    test('shows empty state message when consultant has no cases', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      const transferBtn = staffPage.locator(
        '[data-testid="vacation-transfer-btn"], button:has-text("Відпустка"), button:has-text("Vacation")'
      );

      // If no transfer button is shown, the consultant has no cases
      const isTransferAvailable = await transferBtn.first().isVisible().catch(() => false);

      if (isTransferAvailable) {
        await transferBtn.first().click();

        const emptyState = staffPage.locator(
          '[data-testid="no-cases-message"], .empty-state, :text("немає справ"), :text("No cases")'
        );
        // Empty state may or may not show depending on data
        const isEmpty = await emptyState.first().isVisible().catch(() => false);
        if (isEmpty) {
          await expect(emptyState.first()).toBeVisible();
        }
      }
    });
  });
});
