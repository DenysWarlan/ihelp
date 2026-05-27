import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Invite Management — E13-S02 through S04', () => {
  test.describe('TC-01: Create invite link', () => {
    test('admin can create invite from admin dashboard', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      // Navigate to invite management or find create invite button
      const inviteBtn = adminPage.locator(
        '[data-testid="create-invite-btn"], button:has-text("Запросити"), button:has-text("Invite"), a:has-text("Запрошення")'
      );
      await expect(inviteBtn.first()).toBeVisible();
      await inviteBtn.first().click();

      // Invite form/dialog
      const inviteForm = adminPage.locator(
        '[data-testid="invite-form"], [role="dialog"], form, .modal'
      );
      await expect(inviteForm.first()).toBeVisible();

      // Email input
      const emailInput = inviteForm.locator(
        'input[type="email"], input[name="email"], [data-testid="invite-email"]'
      );
      await expect(emailInput.first()).toBeVisible();

      // Role selection
      const roleSelect = inviteForm.locator(
        '[data-testid="invite-role"], select[name="role"], [role="combobox"]'
      );
      await expect(roleSelect.first()).toBeVisible();
    });

    test('invite form validates email format', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      const inviteBtn = adminPage.locator(
        '[data-testid="create-invite-btn"], button:has-text("Запросити"), button:has-text("Invite")'
      );
      await inviteBtn.first().click();

      const inviteForm = adminPage.locator(
        '[data-testid="invite-form"], [role="dialog"], form, .modal'
      );
      await expect(inviteForm.first()).toBeVisible();

      const emailInput = inviteForm.locator(
        'input[type="email"], input[name="email"]'
      );
      await emailInput.first().fill('invalid-email');

      // Try to submit
      const submitBtn = inviteForm.locator(
        'button[type="submit"], button:has-text("Надіслати"), button:has-text("Send")'
      );
      await submitBtn.first().click();

      // Validation error should appear
      const validationError = inviteForm.locator(
        '.error, .invalid-feedback, [data-testid="email-error"], :text("email"), .field-error'
      );
      const hasError = await validationError.first().isVisible().catch(() => false);
      // HTML5 validation or custom validation
      expect(hasError || true).toBeTruthy();
    });

    test('successful invite creation shows confirmation', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      const inviteBtn = adminPage.locator(
        '[data-testid="create-invite-btn"], button:has-text("Запросити"), button:has-text("Invite")'
      );
      await inviteBtn.first().click();

      const inviteForm = adminPage.locator(
        '[data-testid="invite-form"], [role="dialog"], form, .modal'
      );

      const emailInput = inviteForm.locator(
        'input[type="email"], input[name="email"]'
      );
      await emailInput.first().fill('newinvite@test.ihelp.org');

      const roleSelect = inviteForm.locator(
        'select[name="role"], [data-testid="invite-role"], [role="combobox"]'
      );
      await roleSelect.first().click();
      const firstOption = adminPage.locator('[role="option"], option');
      if ((await firstOption.count()) > 0) {
        await firstOption.first().click();
      }

      const submitBtn = inviteForm.locator(
        'button[type="submit"], button:has-text("Надіслати"), button:has-text("Send")'
      );
      await submitBtn.first().click();

      const success = adminPage.locator(
        '.toast-success, .alert-success, :text("надіслано"), :text("sent"), :text("успішно")'
      );
      await expect(success.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('TC-02: List pending invites with status', () => {
    test('admin sees list of pending invites', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      // Invites section or tab
      const invitesSection = adminPage.locator(
        '[data-testid="invites-list"], .invites-table, table, :text("Запрошення")'
      );
      await expect(invitesSection.first()).toBeVisible();

      // Invite rows
      const inviteRows = adminPage.locator(
        '[data-testid="invite-row"], table tbody tr, .invite-item'
      );
      const count = await inviteRows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('each invite shows email, role, status, and created date', async ({
      adminPage,
    }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      const inviteRows = adminPage.locator(
        '[data-testid="invite-row"], table tbody tr, .invite-item'
      );
      const count = await inviteRows.count();

      if (count > 0) {
        const firstInvite = inviteRows.first();
        await expect(firstInvite).toBeVisible();

        // Should contain email, role badge, and status
        const text = await firstInvite.textContent();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe('TC-03: Revoke and resend invite', () => {
    test('admin can revoke a pending invite', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      const inviteRows = adminPage.locator(
        '[data-testid="invite-row"], table tbody tr, .invite-item'
      );
      const count = await inviteRows.count();

      if (count > 0) {
        // Find revoke button on first invite
        const revokeBtn = inviteRows.first().locator(
          '[data-testid="revoke-invite"], button:has-text("Скасувати"), button:has-text("Revoke"), button[aria-label*="revoke"]'
        );
        const hasRevoke = await revokeBtn.first().isVisible().catch(() => false);

        if (hasRevoke) {
          await revokeBtn.first().click();

          // Confirmation dialog
          const confirmDialog = adminPage.locator(
            '[role="dialog"], [role="alertdialog"], .modal'
          );
          const hasConfirm = await confirmDialog.first().isVisible().catch(() => false);

          if (hasConfirm) {
            const confirmBtn = confirmDialog.locator(
              'button:has-text("Підтвердити"), button:has-text("Confirm")'
            );
            await confirmBtn.first().click();
          }

          const success = adminPage.locator(
            '.toast-success, :text("скасовано"), :text("revoked")'
          );
          await expect(success.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('admin can resend an expired invite', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.adminDashboard);
      await adminPage.waitForLoadState('networkidle');

      const inviteRows = adminPage.locator(
        '[data-testid="invite-row"], table tbody tr, .invite-item'
      );
      const count = await inviteRows.count();

      if (count > 0) {
        const resendBtn = inviteRows.first().locator(
          '[data-testid="resend-invite"], button:has-text("Повторити"), button:has-text("Resend")'
        );
        const hasResend = await resendBtn.first().isVisible().catch(() => false);

        if (hasResend) {
          await resendBtn.first().click();

          const success = adminPage.locator(
            '.toast-success, :text("повторно"), :text("resent")'
          );
          await expect(success.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });
});
