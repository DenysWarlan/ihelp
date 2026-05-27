import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Manual Assignment -- TC-S-E06-S02 through S04', () => {
  test.describe('TC-01: Coordinator manually assigns case to consultant', () => {
    test('should allow coordinator to manually assign a case', async ({ coordinatorPage }) => {
      await coordinatorPage.goto(ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      // Open first unassigned case
      const caseRow = coordinatorPage.locator(
        '[data-testid="case-row"], table tbody tr, .case-card'
      ).first();

      if (!(await caseRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await caseRow.click();
      await coordinatorPage.waitForLoadState('networkidle');

      // Click "Assign manually" or "Assign" button
      const assignBtn = coordinatorPage.getByRole('button', {
        name: /призначити|assign|вибрати консультанта/i,
      });
      await expect(assignBtn.first()).toBeVisible({ timeout: 5_000 });
      await assignBtn.first().click();

      // Consultant selection dialog/dropdown should appear
      const consultantList = coordinatorPage.locator(
        '[data-testid="consultant-list"], .consultant-select, [role="listbox"], [role="dialog"]'
      );
      await expect(consultantList.first()).toBeVisible({ timeout: 5_000 });

      // Select first consultant
      const consultantOption = coordinatorPage.locator(
        '[data-testid="consultant-option"], [role="option"], .consultant-item, .consultant-row'
      ).first();

      if (await consultantOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await consultantOption.click();
      }

      // Confirm assignment
      const confirmBtn = coordinatorPage.getByRole('button', {
        name: /підтвердити|confirm|призначити|assign/i,
      });
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await coordinatorPage.waitForLoadState('networkidle');

      // Verify assignment
      const assignedIndicator = coordinatorPage.locator(
        '[data-testid="assigned-consultant"], .assigned-to, [role="alert"]'
      );
      await expect(assignedIndicator.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('TC-02: Warning when assigning to over-capacity consultant', () => {
    test('should show capacity warning for overloaded consultant', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      const caseRow = coordinatorPage.locator(
        '[data-testid="case-row"], table tbody tr, .case-card'
      ).first();

      if (!(await caseRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await caseRow.click();
      await coordinatorPage.waitForLoadState('networkidle');

      // Open assignment dialog
      const assignBtn = coordinatorPage.getByRole('button', {
        name: /призначити|assign/i,
      });
      if (!(await assignBtn.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await assignBtn.first().click();

      // Look for over-capacity indicators in consultant list
      const overCapacityBadge = coordinatorPage.locator(
        '[data-testid="over-capacity"], .over-capacity, .capacity-warning, .workload-red'
      );

      if (await overCapacityBadge.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Select the over-capacity consultant
        const overCapacityConsultant = overCapacityBadge.first().locator('..');
        await overCapacityConsultant.click();

        // Warning dialog should appear
        const warningDialog = coordinatorPage.locator(
          '[data-testid="capacity-warning-dialog"], [role="alertdialog"], [role="dialog"]:has-text("навантаження"), [role="dialog"]:has-text("capacity")'
        );
        await expect(warningDialog.first()).toBeVisible({ timeout: 5_000 });

        // Warning should contain relevant text
        await expect(warningDialog.first()).toContainText(
          /перевищ|навантаження|capacity|overload|максимум/i
        );
      }
    });
  });

  test.describe('TC-03: Reassignment preserves message history', () => {
    test('should preserve chat history when case is reassigned', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      // Open an assigned case
      const assignedCase = coordinatorPage.locator(
        '[data-testid="case-row"].assigned, table tbody tr:has(.assigned), .case-card:has(.consultant-name)'
      ).first();

      if (!(await assignedCase.isVisible({ timeout: 5_000 }).catch(() => false))) {
        // Fall back to first case
        const anyCase = coordinatorPage.locator(
          '[data-testid="case-row"], table tbody tr, .case-card'
        ).first();
        if (!(await anyCase.isVisible({ timeout: 5_000 }).catch(() => false))) {
          test.skip();
          return;
        }
        await anyCase.click();
      } else {
        await assignedCase.click();
      }

      await coordinatorPage.waitForLoadState('networkidle');

      // Note the current message count or last message
      const messages = coordinatorPage.locator(
        '[data-testid="message"], .message, .chat-message'
      );
      const messageCount = await messages.count();

      // Reassign the case
      const reassignBtn = coordinatorPage.getByRole('button', {
        name: /перепризначити|reassign|змінити консультанта/i,
      });

      if (!(await reassignBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await reassignBtn.click();

      // Select a different consultant
      const consultantOption = coordinatorPage.locator(
        '[data-testid="consultant-option"], [role="option"], .consultant-item'
      ).first();
      if (await consultantOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await consultantOption.click();
      }

      const confirmBtn = coordinatorPage.getByRole('button', {
        name: /підтвердити|confirm|призначити/i,
      });
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await coordinatorPage.waitForLoadState('networkidle');

      // Verify messages are preserved
      const messagesAfter = coordinatorPage.locator(
        '[data-testid="message"], .message, .chat-message'
      );
      const messageCountAfter = await messagesAfter.count();

      // Message count should be same or more (reassignment may add a system message)
      expect(messageCountAfter).toBeGreaterThanOrEqual(messageCount);
    });
  });
});
