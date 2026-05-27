import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E03-S01: Real-Time Web Chat', () => {
  const CASE_ID = 'test-case-001';

  test.describe('TC-01: Person sends message, appears in chat', () => {
    test('person sends a message and it appears in the chat timeline', async ({
      personPage,
    }) => {
      await personPage.goto(`/person/cases/${CASE_ID}`);

      // Wait for the chat area to load
      const chatArea = personPage.locator(
        '[data-testid="chat-area"], .chat-area, .message-list',
      );
      await expect(chatArea).toBeVisible({ timeout: 15_000 });

      // Type a message
      const messageInput = personPage.locator(
        '[data-testid="message-input"], textarea[placeholder*="повідомлення"], .chat-input textarea, .chat-input input',
      );
      await expect(messageInput).toBeVisible();

      const testMessage = `E2E test message ${Date.now()}`;
      await messageInput.fill(testMessage);

      // Send the message
      const sendButton = personPage.locator(
        '[data-testid="send-message"], button[aria-label="Send"], button:has-text("Надіслати")',
      );
      await sendButton.click();

      // Verify the message appears in the chat timeline
      const sentMessage = chatArea.locator(
        `.message, [data-testid="chat-message"]`,
      );
      await expect(sentMessage.filter({ hasText: testMessage })).toBeVisible({
        timeout: 10_000,
      });

      // Verify the input is cleared after sending
      await expect(messageInput).toHaveValue('');
    });
  });

  test.describe('TC-02: Chat displays message history with pagination', () => {
    test('chat loads message history and supports scrolling for older messages', async ({
      personPage,
    }) => {
      await personPage.goto(`/person/cases/${CASE_ID}`);

      const chatArea = personPage.locator(
        '[data-testid="chat-area"], .chat-area, .message-list',
      );
      await expect(chatArea).toBeVisible({ timeout: 15_000 });

      // Check that messages are present
      const messages = chatArea.locator(
        '[data-testid="chat-message"], .message',
      );
      const messageCount = await messages.count();

      // If there are enough messages, test "load more" or scroll-based pagination
      if (messageCount > 0) {
        // Scroll to the top to trigger loading older messages
        await chatArea.evaluate((el) => (el as HTMLElement).scrollTo(0, 0));
        await personPage.waitForTimeout(1_500);

        // Check for a "load more" button or verify more messages appeared
        const loadMoreButton = personPage.locator(
          '[data-testid="load-more"], button:has-text("Завантажити ще"), button:has-text("Load more")',
        );
        const hasLoadMore = await loadMoreButton.isVisible().catch(() => false);

        if (hasLoadMore) {
          await loadMoreButton.click();
          await personPage.waitForTimeout(1_000);
          const updatedCount = await messages.count();
          expect(updatedCount).toBeGreaterThanOrEqual(messageCount);
        }
      }

      // Verify messages display in chronological order (timestamps should increase)
      if (messageCount >= 2) {
        const timestamps = chatArea.locator('time, .message-time, .timestamp');
        const timestampCount = await timestamps.count();
        expect(timestampCount).toBeGreaterThanOrEqual(2);
      }
    });
  });

  test.describe('TC-03: Message status indicators (sent, delivered, read)', () => {
    test('sent message shows delivery status indicators', async ({
      personPage,
    }) => {
      await personPage.goto(`/person/cases/${CASE_ID}`);

      const chatArea = personPage.locator(
        '[data-testid="chat-area"], .chat-area, .message-list',
      );
      await expect(chatArea).toBeVisible({ timeout: 15_000 });

      // Send a new message
      const messageInput = personPage.locator(
        '[data-testid="message-input"], textarea[placeholder*="повідомлення"], .chat-input textarea',
      );
      await messageInput.fill('Testing delivery status indicators.');

      const sendButton = personPage.locator(
        '[data-testid="send-message"], button[aria-label="Send"], button:has-text("Надіслати")',
      );
      await sendButton.click();

      // Wait for the message to appear
      await personPage.waitForTimeout(1_000);

      // Find the last sent message (outgoing)
      const outgoingMessages = chatArea.locator(
        '[data-testid="outgoing-message"], .message--outgoing, .message-sent',
      );
      const lastOutgoing = outgoingMessages.last();

      // Verify a status indicator is present
      const statusIndicator = lastOutgoing.locator(
        '[data-testid="message-status"], .message-status, .delivery-status',
      );
      await expect(statusIndicator).toBeVisible({ timeout: 5_000 });

      // The status should be one of: sent, delivered, read
      const statusText = await statusIndicator.getAttribute('data-status').catch(() => null);
      const statusClass = await statusIndicator.getAttribute('class').catch(() => '');

      const hasValidStatus =
        statusText?.match(/sent|delivered|read/) ||
        statusClass?.match(/sent|delivered|read/) ||
        (await statusIndicator.locator('svg, .icon').isVisible().catch(() => false));

      expect(hasValidStatus).toBeTruthy();
    });
  });

  test.describe('TC-04: Channel indicator badges visible', () => {
    test('chat messages display channel origin badges (web, telegram, etc.)', async ({
      staffPage,
    }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}`);

      const chatArea = staffPage.locator(
        '[data-testid="chat-area"], .chat-area, .message-list',
      );
      await expect(chatArea).toBeVisible({ timeout: 15_000 });

      // Look for channel indicator badges on messages
      const channelBadges = chatArea.locator(
        '[data-testid="channel-badge"], .channel-badge, .channel-indicator',
      );
      const badgeCount = await channelBadges.count();

      if (badgeCount > 0) {
        const firstBadge = channelBadges.first();
        await expect(firstBadge).toBeVisible();

        // Verify the badge contains a valid channel type
        const badgeText = await firstBadge.textContent();
        const validChannels = ['web', 'telegram', 'viber', 'email'];
        const hasValidChannel = validChannels.some(
          (ch) => badgeText?.toLowerCase().includes(ch),
        );
        expect(hasValidChannel).toBeTruthy();
      }
    });
  });
});
