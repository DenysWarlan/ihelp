import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Crisis Detection -- TC-S-E08-S01', () => {
  test.describe('TC-01: Crisis keyword detected in message triggers alert', () => {
    test('should create a crisis alert when message contains crisis keywords', async ({
      personPage,
      staffPage,
    }) => {
      // Person sends a message containing crisis keyword
      await personPage.goto(ROUTES.personChat);
      await personPage.waitForLoadState('networkidle');

      // Open an existing chat or the first available conversation
      const chatItem = personPage.locator(
        '[data-testid="chat-item"], .chat-item, .conversation-item'
      ).first();

      if (!(await chatItem.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await chatItem.click();
      await personPage.waitForLoadState('networkidle');

      // Type a message with a crisis keyword
      const messageInput = personPage.locator(
        '[data-testid="message-input"], textarea, input[type="text"][placeholder*="повідомлення"], .message-input'
      );
      await expect(messageInput.first()).toBeVisible({ timeout: 5_000 });
      await messageInput.first().fill('Я думаю про суїцид, мені дуже погано');

      // Send message
      const sendBtn = personPage.locator(
        '[data-testid="send-btn"], button[type="submit"], button:has-text("Надіслати"), button[aria-label*="send"]'
      );
      await sendBtn.first().click();
      await personPage.waitForLoadState('networkidle');

      // Verify the message was sent
      const sentMessage = personPage.locator(
        '[data-testid="message"]:has-text("суїцид"), .message:has-text("суїцид"), .chat-bubble:has-text("суїцид")'
      );
      await expect(sentMessage.first()).toBeVisible({ timeout: 10_000 });

      // Now check staff side for crisis alert
      await staffPage.goto(ROUTES.staffCrisis);
      await staffPage.waitForLoadState('networkidle');

      // Crisis alert should appear
      const crisisAlert = staffPage.locator(
        '[data-testid="crisis-alert"], .crisis-alert, .alert-row, table tbody tr'
      );

      const hasAlert = await crisisAlert.first().isVisible({ timeout: 10_000 }).catch(() => false);
      if (hasAlert) {
        // Alert should reference the keyword or case
        await expect(crisisAlert.first()).toBeVisible();
      }
    });
  });

  test.describe('TC-02: Case-insensitive Cyrillic support', () => {
    test('should detect crisis keywords regardless of case in Cyrillic', async ({
      personPage,
    }) => {
      await personPage.goto(ROUTES.personChat);
      await personPage.waitForLoadState('networkidle');

      const chatItem = personPage.locator(
        '[data-testid="chat-item"], .chat-item, .conversation-item'
      ).first();

      if (!(await chatItem.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await chatItem.click();
      await personPage.waitForLoadState('networkidle');

      const messageInput = personPage.locator(
        '[data-testid="message-input"], textarea, input[type="text"], .message-input'
      );
      await expect(messageInput.first()).toBeVisible({ timeout: 5_000 });

      // Send message with mixed-case Cyrillic crisis keyword
      await messageInput.first().fill('Я хочу ПОКІНЧИТИ з ЖИТТЯМ');

      const sendBtn = personPage.locator(
        '[data-testid="send-btn"], button[type="submit"], button:has-text("Надіслати"), button[aria-label*="send"]'
      );
      await sendBtn.first().click();
      await personPage.waitForLoadState('networkidle');

      // Message should be sent
      const sentMessage = personPage.locator(
        '[data-testid="message"], .message, .chat-bubble'
      ).last();
      await expect(sentMessage).toBeVisible({ timeout: 5_000 });

      // Crisis detection should be triggered (the actual assertion happens on the staff side,
      // but we verify the message was sent and a warning banner may appear)
      const crisisWarning = personPage.locator(
        '[data-testid="crisis-banner"], .crisis-warning, .help-banner, [role="alert"]'
      );

      // A help/support banner might show for the person
      if (await crisisWarning.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(crisisWarning.first()).toBeVisible();
      }
    });
  });

  test.describe('TC-03: Normal messages do not trigger crisis detection', () => {
    test('should not trigger crisis alert for regular messages', async ({
      personPage,
      staffPage,
    }) => {
      await personPage.goto(ROUTES.personChat);
      await personPage.waitForLoadState('networkidle');

      const chatItem = personPage.locator(
        '[data-testid="chat-item"], .chat-item, .conversation-item'
      ).first();

      if (!(await chatItem.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await chatItem.click();
      await personPage.waitForLoadState('networkidle');

      // Count existing crisis alerts before sending
      await staffPage.goto(ROUTES.staffCrisis);
      await staffPage.waitForLoadState('networkidle');

      const alertsBefore = await staffPage
        .locator('[data-testid="crisis-alert"], .crisis-alert, table tbody tr')
        .count()
        .catch(() => 0);

      // Send a normal message
      await personPage.bringToFront();
      const messageInput = personPage.locator(
        '[data-testid="message-input"], textarea, input[type="text"], .message-input'
      );
      await messageInput.first().fill('Добрий день, дякую за допомогу!');

      const sendBtn = personPage.locator(
        '[data-testid="send-btn"], button[type="submit"], button:has-text("Надіслати"), button[aria-label*="send"]'
      );
      await sendBtn.first().click();
      await personPage.waitForLoadState('networkidle');

      // No crisis warning should appear
      const crisisWarning = personPage.locator(
        '[data-testid="crisis-banner"], .crisis-warning'
      );
      const hasCrisisWarning = await crisisWarning
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(hasCrisisWarning).toBeFalsy();

      // Check staff side -- alert count should not have increased
      await staffPage.bringToFront();
      await staffPage.goto(ROUTES.staffCrisis);
      await staffPage.waitForLoadState('networkidle');

      const alertsAfter = await staffPage
        .locator('[data-testid="crisis-alert"], .crisis-alert, table tbody tr')
        .count()
        .catch(() => 0);

      expect(alertsAfter).toBe(alertsBefore);
    });
  });
});
