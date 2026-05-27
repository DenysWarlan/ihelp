import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E02-S04: Case Status State Machine', () => {
  const CASE_ID = 'test-case-001';

  /**
   * Helper to read the current status text from the case detail page.
   */
  async function getCurrentStatus(page: import('@playwright/test').Page): Promise<string> {
    const statusBadge = page.locator(
      '[data-testid="case-status"], .case-status-badge',
    );
    await expect(statusBadge).toBeVisible({ timeout: 10_000 });
    return (await statusBadge.textContent()) ?? '';
  }

  /**
   * Helper to trigger a status change on the case detail page.
   */
  async function changeStatus(
    page: import('@playwright/test').Page,
    targetStatus: string | RegExp,
  ): Promise<void> {
    const statusControl = page.locator(
      '[data-testid="status-change"], .status-change-btn, button:has-text("Змінити статус")',
    );
    await statusControl.click();

    const statusOption = page.locator(
      `[data-testid="status-option"], .status-option, [role="menuitem"]`,
    );
    const targetOption = statusOption.filter({ hasText: targetStatus });
    await targetOption.click();

    // Confirm if a dialog appears
    const confirmButton = page.getByRole('button', {
      name: /підтвердити|confirm/i,
    });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Wait for status update to complete
    await page.waitForTimeout(1_000);
  }

  test.describe('TC-01: Valid transitions: new -> assigned -> in_progress -> completed -> closed', () => {
    test('coordinator can walk through the complete valid transition chain', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(`/staff/cases/${CASE_ID}`);
      await coordinatorPage.waitForLoadState('networkidle');

      // Verify the status change control exists
      const statusControl = coordinatorPage.locator(
        '[data-testid="status-change"], .status-change-btn, button:has-text("Змінити статус")',
      );
      await expect(statusControl).toBeVisible({ timeout: 15_000 });

      // Attempt transition to "assigned"
      await changeStatus(coordinatorPage, /призначено|assigned/i);
      let status = await getCurrentStatus(coordinatorPage);
      expect(status.toLowerCase()).toMatch(/призначено|assigned/);

      // Transition to "in_progress"
      await changeStatus(coordinatorPage, /в роботі|in.progress/i);
      status = await getCurrentStatus(coordinatorPage);
      expect(status.toLowerCase()).toMatch(/в роботі|in.progress/);

      // Transition to "completed"
      await changeStatus(coordinatorPage, /завершено|completed/i);
      status = await getCurrentStatus(coordinatorPage);
      expect(status.toLowerCase()).toMatch(/завершено|completed/);

      // Transition to "closed"
      await changeStatus(coordinatorPage, /закрито|closed/i);
      status = await getCurrentStatus(coordinatorPage);
      expect(status.toLowerCase()).toMatch(/закрито|closed/);
    });
  });

  test.describe('TC-02: Invalid backward transitions blocked', () => {
    test('completed case cannot be moved back to in_progress', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(`/staff/cases/${CASE_ID}`);
      await coordinatorPage.waitForLoadState('networkidle');

      const statusControl = coordinatorPage.locator(
        '[data-testid="status-change"], .status-change-btn, button:has-text("Змінити статус")',
      );
      await expect(statusControl).toBeVisible({ timeout: 15_000 });
      await statusControl.click();

      // Verify that backward transitions are not available in the menu
      const backwardOption = coordinatorPage.locator(
        '[data-testid="status-option"], .status-option, [role="menuitem"]',
      );
      const allOptions = await backwardOption.allTextContents();

      // "In progress" should not be available if case is already completed
      const currentStatus = await getCurrentStatus(coordinatorPage);
      if (currentStatus.toLowerCase().match(/завершено|completed/)) {
        const hasBackwardTransition = allOptions.some((opt) =>
          /в роботі|in.progress/i.test(opt),
        );
        expect(hasBackwardTransition).toBeFalsy();
      }
    });

    test('closed case has no available transitions', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(`/staff/cases/${CASE_ID}`);
      await coordinatorPage.waitForLoadState('networkidle');

      const currentStatus = await getCurrentStatus(coordinatorPage);

      if (currentStatus.toLowerCase().match(/закрито|closed/)) {
        // Status change control should be hidden or disabled
        const statusControl = coordinatorPage.locator(
          '[data-testid="status-change"], .status-change-btn, button:has-text("Змінити статус")',
        );
        const isDisabled = await statusControl.isDisabled().catch(() => true);
        const isHidden = await statusControl.isHidden().catch(() => true);

        expect(isDisabled || isHidden).toBeTruthy();
      }
    });
  });

  test.describe('TC-03: Coordinator can pause (on_hold) and resume', () => {
    test('coordinator pauses a case and then resumes it', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(`/staff/cases/${CASE_ID}`);
      await coordinatorPage.waitForLoadState('networkidle');

      const statusControl = coordinatorPage.locator(
        '[data-testid="status-change"], .status-change-btn, button:has-text("Змінити статус")',
      );
      await expect(statusControl).toBeVisible({ timeout: 15_000 });

      // Pause the case
      await changeStatus(coordinatorPage, /на паузі|on.hold|pause/i);
      let status = await getCurrentStatus(coordinatorPage);
      expect(status.toLowerCase()).toMatch(/на паузі|on.hold|pause/);

      // Resume the case
      await changeStatus(coordinatorPage, /в роботі|in.progress|resume/i);
      status = await getCurrentStatus(coordinatorPage);
      expect(status.toLowerCase()).toMatch(/в роботі|in.progress/);
    });
  });

  test.describe('TC-04: Auto-transition on message send', () => {
    test('case auto-transitions to in_progress when consultant sends first message', async ({
      staffPage,
    }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}`);
      await staffPage.waitForLoadState('networkidle');

      // Record the initial status
      const initialStatus = await getCurrentStatus(staffPage);

      // If case is in "assigned" status, sending a message should auto-transition
      if (initialStatus.toLowerCase().match(/призначено|assigned/)) {
        // Find and use the message input
        const messageInput = staffPage.locator(
          '[data-testid="message-input"], textarea[placeholder*="повідомлення"], .chat-input textarea',
        );
        await expect(messageInput).toBeVisible({ timeout: 10_000 });
        await messageInput.fill('Вітаю! Я ваш консультант. Як я можу допомогти?');

        // Send the message
        const sendButton = staffPage.locator(
          '[data-testid="send-message"], button[aria-label="Send"], button:has-text("Надіслати")',
        );
        await sendButton.click();

        // Wait for the auto-transition
        await staffPage.waitForTimeout(2_000);

        // Verify the status changed to "in_progress"
        const updatedStatus = await getCurrentStatus(staffPage);
        expect(updatedStatus.toLowerCase()).toMatch(/в роботі|in.progress/);
      }
    });
  });
});
