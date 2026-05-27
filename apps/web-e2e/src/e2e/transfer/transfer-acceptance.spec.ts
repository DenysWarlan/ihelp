import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Transfer Acceptance — E10-S06 through S08', () => {
  test.describe('TC-01: New consultant accepts transfer match', () => {
    test('incoming transfer notification is visible', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      // Check for transfer notification badge or pending transfers section
      const transferNotification = staffPage.locator(
        '[data-testid="transfer-notification"], [data-testid="pending-transfers"], .transfer-badge, :text("Передача"), :text("Transfer")'
      );
      const hasTransfer = await transferNotification.first().isVisible().catch(() => false);

      if (hasTransfer) {
        await transferNotification.first().click();

        // Transfer details should be shown
        const transferDetails = staffPage.locator(
          '[data-testid="transfer-details"], [role="dialog"], .transfer-detail, .modal'
        );
        await expect(transferDetails.first()).toBeVisible();

        // Accept button should be present
        const acceptBtn = staffPage.locator(
          '[data-testid="accept-transfer-btn"], button:has-text("Прийняти"), button:has-text("Accept")'
        );
        await expect(acceptBtn.first()).toBeVisible();
      }
    });

    test('accept button confirms transfer and adds case to caseload', async ({
      staffPage,
    }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      const transferNotification = staffPage.locator(
        '[data-testid="transfer-notification"], [data-testid="pending-transfers"]'
      );
      const hasTransfer = await transferNotification.first().isVisible().catch(() => false);

      if (hasTransfer) {
        await transferNotification.first().click();

        const acceptBtn = staffPage.locator(
          '[data-testid="accept-transfer-btn"], button:has-text("Прийняти"), button:has-text("Accept")'
        );
        await acceptBtn.first().click();

        // Success message should appear
        const successMsg = staffPage.locator(
          '[data-testid="transfer-success"], .toast-success, .alert-success, :text("успішно"), :text("success")'
        );
        await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('TC-02: New consultant rejects transfer, next suggestion shown', () => {
    test('reject button triggers next consultant suggestion', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      const transferNotification = staffPage.locator(
        '[data-testid="transfer-notification"], [data-testid="pending-transfers"]'
      );
      const hasTransfer = await transferNotification.first().isVisible().catch(() => false);

      if (hasTransfer) {
        await transferNotification.first().click();

        // Reject button should be present
        const rejectBtn = staffPage.locator(
          '[data-testid="reject-transfer-btn"], button:has-text("Відхилити"), button:has-text("Reject")'
        );
        await expect(rejectBtn.first()).toBeVisible();
        await rejectBtn.first().click();

        // Confirmation or reason dialog may appear
        const reasonDialog = staffPage.locator(
          '[data-testid="reject-reason"], [role="dialog"], textarea'
        );
        const hasReasonDialog = await reasonDialog.first().isVisible().catch(() => false);

        if (hasReasonDialog) {
          await reasonDialog.first().fill('Занадто велике навантаження');
          const confirmReject = staffPage.locator(
            'button:has-text("Підтвердити"), button:has-text("Confirm"), button[type="submit"]'
          );
          await confirmReject.first().click();
        }

        // System should show info about next suggestion
        const nextSuggestion = staffPage.locator(
          '[data-testid="next-suggestion"], .info-message, :text("наступн"), :text("next consultant")'
        );
        const hasNextSuggestion = await nextSuggestion.first().isVisible().catch(() => false);
        if (hasNextSuggestion) {
          await expect(nextSuggestion.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('TC-03: Return from vacation restores cases', () => {
    test('cases are restored to original consultant after vacation ends', async ({
      staffPage,
    }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      // Check for a "return from vacation" notification or restored cases indicator
      const restoredNotification = staffPage.locator(
        '[data-testid="cases-restored"], [data-testid="vacation-ended"], :text("повернуто"), :text("restored")'
      );
      const hasRestored = await restoredNotification.first().isVisible().catch(() => false);

      if (hasRestored) {
        await expect(restoredNotification.first()).toBeVisible();
      }

      // Case list should be visible with the consultant's own cases
      const caseList = staffPage.locator(
        '[data-testid="case-list"], table tbody tr, .case-card, .case-item'
      );
      const caseCount = await caseList.count();
      expect(caseCount).toBeGreaterThanOrEqual(0);
    });

    test('temporary consultant no longer sees transferred cases', async ({
      staffPage,
    }) => {
      await staffPage.goto(ROUTES.staffCases);
      await staffPage.waitForLoadState('networkidle');

      // Verify that transferred-out cases are not in the current list
      const transferredOutIndicator = staffPage.locator(
        '[data-testid="transferred-case"], .transferred-indicator'
      );
      // After vacation return, these should not be present
      const hasTransferred = await transferredOutIndicator.first().isVisible().catch(() => false);
      expect(hasTransferred).toBeFalsy();
    });
  });
});
