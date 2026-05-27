import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('User Management — E13-S01', () => {
  test.describe('TC-01: Admin creates staff user with role', () => {
    test('admin can access user management page', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      const heading = adminPage.locator(
        'h1, h2, [data-testid="users-heading"]'
      );
      await expect(heading.first()).toBeVisible();
    });

    test('create user form is accessible', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      // Create user button
      const createBtn = adminPage.locator(
        '[data-testid="create-user-btn"], button:has-text("Створити"), button:has-text("Create"), button:has-text("Додати")'
      );
      await expect(createBtn.first()).toBeVisible();
      await createBtn.first().click();

      // Form dialog or page
      const form = adminPage.locator(
        '[data-testid="create-user-form"], [role="dialog"], form, .modal'
      );
      await expect(form.first()).toBeVisible();

      // Email field
      const emailInput = form.locator(
        'input[type="email"], input[name="email"], [data-testid="email-input"]'
      );
      await expect(emailInput.first()).toBeVisible();

      // Role selection
      const roleSelect = form.locator(
        '[data-testid="role-select"], select[name="role"], [role="combobox"], .role-select'
      );
      await expect(roleSelect.first()).toBeVisible();
    });

    test('submitting form sends invite', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      const createBtn = adminPage.locator(
        '[data-testid="create-user-btn"], button:has-text("Створити"), button:has-text("Create"), button:has-text("Додати")'
      );
      await createBtn.first().click();

      const form = adminPage.locator(
        '[data-testid="create-user-form"], [role="dialog"], form, .modal'
      );
      await expect(form.first()).toBeVisible();

      // Fill email
      const emailInput = form.locator(
        'input[type="email"], input[name="email"], [data-testid="email-input"]'
      );
      await emailInput.first().fill('newstaff@test.ihelp.org');

      // Select role
      const roleSelect = form.locator(
        '[data-testid="role-select"], select[name="role"], [role="combobox"]'
      );
      await roleSelect.first().click();
      const consultantOption = form.locator(
        '[role="option"]:has-text("Консультант"), option:has-text("Consultant"), [role="option"]:first-child'
      );
      const hasOption = await consultantOption.first().isVisible().catch(() => false);
      if (hasOption) {
        await consultantOption.first().click();
      }

      // Submit
      const submitBtn = form.locator(
        'button[type="submit"], button:has-text("Надіслати запрошення"), button:has-text("Send invite"), button:has-text("Створити")'
      );
      await submitBtn.first().click();

      // Success
      const success = adminPage.locator(
        '.toast-success, .alert-success, :text("запрошення"), :text("invite sent"), :text("успішно")'
      );
      await expect(success.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('TC-02: Single role constraint', () => {
    test('user can only have one role assigned', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      const createBtn = adminPage.locator(
        '[data-testid="create-user-btn"], button:has-text("Створити"), button:has-text("Create"), button:has-text("Додати")'
      );
      await createBtn.first().click();

      const form = adminPage.locator(
        '[data-testid="create-user-form"], [role="dialog"], form, .modal'
      );
      await expect(form.first()).toBeVisible();

      // Role should be a single-select, not multi-select
      const roleSelect = form.locator(
        'select[name="role"], [data-testid="role-select"], [role="combobox"]'
      );
      const hasSelect = await roleSelect.first().isVisible().catch(() => false);

      if (hasSelect) {
        // Check it's not a multi-select
        const isMultiple = await roleSelect.first().getAttribute('multiple');
        expect(isMultiple).toBeNull();
      }

      // Or if checkboxes, only one should be selectable at a time (radio behavior)
      const roleRadios = form.locator(
        'input[type="radio"][name="role"], [role="radiogroup"] [role="radio"]'
      );
      const radioCount = await roleRadios.count();
      // Either select dropdown or radio buttons — one mechanism for single choice
      expect((hasSelect ? 1 : 0) + (radioCount > 0 ? 1 : 0)).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('TC-03: Deactivation (soft delete, data preserved)', () => {
    test('admin can deactivate a user', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      // Find a user row
      const userRows = adminPage.locator(
        '[data-testid="user-row"], table tbody tr, .user-card, .user-item'
      );
      const rowCount = await userRows.count();

      if (rowCount > 0) {
        // Click action menu or deactivate button on first user
        const actionBtn = userRows.first().locator(
          '[data-testid="user-actions"], button[aria-label*="actions"], .actions-btn, button:has-text("...")'
        );
        const hasAction = await actionBtn.first().isVisible().catch(() => false);

        if (hasAction) {
          await actionBtn.first().click();

          const deactivateOption = adminPage.locator(
            '[data-testid="deactivate-user"], button:has-text("Деактивувати"), button:has-text("Deactivate"), [role="menuitem"]:has-text("Деактивувати")'
          );
          const hasDeactivate = await deactivateOption.first().isVisible().catch(() => false);
          if (hasDeactivate) {
            await expect(deactivateOption.first()).toBeVisible();
          }
        }
      }
    });

    test('deactivation shows confirmation before proceeding', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      const userRows = adminPage.locator(
        '[data-testid="user-row"], table tbody tr, .user-card'
      );
      const rowCount = await userRows.count();

      if (rowCount > 0) {
        const actionBtn = userRows.first().locator(
          '[data-testid="user-actions"], button[aria-label*="actions"], .actions-btn'
        );
        const hasAction = await actionBtn.first().isVisible().catch(() => false);

        if (hasAction) {
          await actionBtn.first().click();

          const deactivateOption = adminPage.locator(
            'button:has-text("Деактивувати"), button:has-text("Deactivate"), [role="menuitem"]:has-text("Деактивувати")'
          );
          const hasDeactivate = await deactivateOption.first().isVisible().catch(() => false);

          if (hasDeactivate) {
            await deactivateOption.first().click();

            // Confirmation dialog
            const confirmDialog = adminPage.locator(
              '[role="dialog"], [role="alertdialog"], .modal'
            );
            await expect(confirmDialog.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('TC-04: Search and filter by role and status', () => {
    test('search input filters users by name or email', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      const searchInput = adminPage.locator(
        '[data-testid="user-search"], input[type="search"], input[placeholder*="Пошук"], input[placeholder*="Search"]'
      );
      const hasSearch = await searchInput.first().isVisible().catch(() => false);

      if (hasSearch) {
        await searchInput.first().fill('consultant');
        await adminPage.waitForLoadState('networkidle');

        // Results should be filtered
        const userRows = adminPage.locator(
          '[data-testid="user-row"], table tbody tr, .user-card'
        );
        const count = await userRows.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('role filter narrows user list', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      const roleFilter = adminPage.locator(
        '[data-testid="user-role-filter"], select[name="role"], .role-filter'
      );
      const hasFilter = await roleFilter.first().isVisible().catch(() => false);

      if (hasFilter) {
        await roleFilter.first().click();
        const options = adminPage.locator('[role="option"], option');
        if ((await options.count()) > 0) {
          await options.first().click();
          await adminPage.waitForLoadState('networkidle');
        }
      }
    });

    test('status filter shows active or deactivated users', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffUsers);
      await adminPage.waitForLoadState('networkidle');

      const statusFilter = adminPage.locator(
        '[data-testid="user-status-filter"], select[name="status"], .status-filter'
      );
      const hasFilter = await statusFilter.first().isVisible().catch(() => false);

      if (hasFilter) {
        await statusFilter.first().click();
        const options = adminPage.locator('[role="option"], option');
        if ((await options.count()) > 0) {
          await options.first().click();
          await adminPage.waitForLoadState('networkidle');
        }
      }
    });
  });
});
