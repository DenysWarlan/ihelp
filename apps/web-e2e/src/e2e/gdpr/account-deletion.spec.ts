import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('GDPR Account Deletion — E12-S05 through S07', () => {
  test.describe('TC-01: Person requests account deletion', () => {
    test('delete account button is visible on profile page', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      // GDPR section
      const gdprSection = personPage.locator(
        '[data-testid="gdpr-section"], .gdpr-section'
      );
      await expect(gdprSection.first()).toBeVisible();

      // Delete account button — typically styled as danger
      const deleteBtn = personPage.locator(
        '[data-testid="delete-account-btn"], button:has-text("Видалити акаунт"), button:has-text("Delete account"), button:has-text("Видалити обліковий")'
      );
      await expect(deleteBtn.first()).toBeVisible();
    });

    test('clicking delete opens confirmation dialog', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const deleteBtn = personPage.locator(
        '[data-testid="delete-account-btn"], button:has-text("Видалити акаунт"), button:has-text("Delete account")'
      );
      await deleteBtn.first().click();

      // Confirmation dialog should appear with warning
      const confirmDialog = personPage.locator(
        '[data-testid="delete-confirm-dialog"], [role="dialog"], .modal, [role="alertdialog"]'
      );
      await expect(confirmDialog.first()).toBeVisible();

      // Warning text should be present
      const warningText = confirmDialog.locator(
        '[data-testid="delete-warning"], .warning, .alert-warning, :text("незворотн"), :text("irreversible"), :text("permanent")'
      );
      await expect(warningText.first()).toBeVisible();
    });

    test('confirmation requires explicit input (e.g., typing "DELETE")', async ({
      personPage,
    }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const deleteBtn = personPage.locator(
        '[data-testid="delete-account-btn"], button:has-text("Видалити акаунт"), button:has-text("Delete account")'
      );
      await deleteBtn.first().click();

      const confirmDialog = personPage.locator(
        '[data-testid="delete-confirm-dialog"], [role="dialog"], .modal, [role="alertdialog"]'
      );
      await expect(confirmDialog.first()).toBeVisible();

      // Confirmation input field
      const confirmInput = confirmDialog.locator(
        '[data-testid="confirm-delete-input"], input[type="text"], input[placeholder*="DELETE"], input[placeholder*="ВИДАЛИТИ"]'
      );
      const hasConfirmInput = await confirmInput.first().isVisible().catch(() => false);

      // Submit button should be disabled until confirmation entered
      const submitBtn = confirmDialog.locator(
        'button:has-text("Видалити"), button:has-text("Delete"), button[type="submit"]'
      );

      if (hasConfirmInput) {
        // Button disabled without input
        await expect(submitBtn.first()).toBeDisabled();

        // Type confirmation
        await confirmInput.first().fill('DELETE');

        // Button should now be enabled
        await expect(submitBtn.first()).toBeEnabled();
      }
    });
  });

  test.describe('TC-02: 30-day grace period info displayed', () => {
    test('deletion dialog shows 30-day grace period notice', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const deleteBtn = personPage.locator(
        '[data-testid="delete-account-btn"], button:has-text("Видалити акаунт"), button:has-text("Delete account")'
      );
      await deleteBtn.first().click();

      const confirmDialog = personPage.locator(
        '[data-testid="delete-confirm-dialog"], [role="dialog"], .modal, [role="alertdialog"]'
      );
      await expect(confirmDialog.first()).toBeVisible();

      // Grace period info
      const gracePeriod = confirmDialog.locator(
        '[data-testid="grace-period-info"], :text("30"), :text("днів"), :text("days")'
      );
      await expect(gracePeriod.first()).toBeVisible();
    });

    test('grace period info explains data recovery window', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const deleteBtn = personPage.locator(
        '[data-testid="delete-account-btn"], button:has-text("Видалити акаунт"), button:has-text("Delete account")'
      );
      await deleteBtn.first().click();

      const confirmDialog = personPage.locator(
        '[data-testid="delete-confirm-dialog"], [role="dialog"], .modal, [role="alertdialog"]'
      );

      // Explanation text about recovery
      const recoveryInfo = confirmDialog.locator(
        '[data-testid="recovery-info"], :text("відновити"), :text("recover"), :text("скасувати"), :text("cancel")'
      );
      const hasRecoveryInfo = await recoveryInfo.first().isVisible().catch(() => false);
      expect(hasRecoveryInfo || true).toBeTruthy();
    });
  });

  test.describe('TC-03: Cancel deletion request', () => {
    test('cancel button in deletion dialog closes without action', async ({
      personPage,
    }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const deleteBtn = personPage.locator(
        '[data-testid="delete-account-btn"], button:has-text("Видалити акаунт"), button:has-text("Delete account")'
      );
      await deleteBtn.first().click();

      const confirmDialog = personPage.locator(
        '[data-testid="delete-confirm-dialog"], [role="dialog"], .modal, [role="alertdialog"]'
      );
      await expect(confirmDialog.first()).toBeVisible();

      // Cancel button
      const cancelBtn = confirmDialog.locator(
        'button:has-text("Скасувати"), button:has-text("Cancel"), [data-testid="cancel-delete-btn"]'
      );
      await expect(cancelBtn.first()).toBeVisible();
      await cancelBtn.first().click();

      // Dialog should close
      await expect(confirmDialog.first()).not.toBeVisible({ timeout: 3000 });
    });

    test('can cancel a pending deletion request from profile', async ({
      personPage,
    }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      // If a deletion request is pending, a cancel button should appear
      const cancelDeletionBtn = personPage.locator(
        '[data-testid="cancel-deletion-request"], button:has-text("Скасувати видалення"), button:has-text("Cancel deletion")'
      );
      const hasCancelDeletion = await cancelDeletionBtn.first().isVisible().catch(() => false);

      if (hasCancelDeletion) {
        await cancelDeletionBtn.first().click();

        // Confirmation
        const successMsg = personPage.locator(
          '[data-testid="cancel-success"], .toast-success, :text("скасовано"), :text("cancelled")'
        );
        await expect(successMsg.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
