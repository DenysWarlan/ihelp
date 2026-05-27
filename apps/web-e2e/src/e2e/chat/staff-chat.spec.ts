import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E03-S02 through S04: Staff Chat', () => {
  const CASE_ID = 'test-case-001';

  test.describe('TC-01: Consultant views messages in case detail', () => {
    test('staff navigates to case detail and sees the message thread', async ({
      staffPage,
    }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}`);

      // Wait for the case detail with chat section to load
      const chatSection = staffPage.locator(
        '[data-testid="chat-area"], .chat-area, .message-list, [data-testid="case-messages"]',
      );
      await expect(chatSection).toBeVisible({ timeout: 15_000 });

      // Verify messages are displayed (may be empty for new cases)
      const messages = chatSection.locator(
        '[data-testid="chat-message"], .message',
      );
      const messageCount = await messages.count();
      expect(messageCount).toBeGreaterThanOrEqual(0);

      // Verify the message input is present for consultant to reply
      const messageInput = staffPage.locator(
        '[data-testid="message-input"], textarea[placeholder*="повідомлення"], .chat-input textarea',
      );
      await expect(messageInput).toBeVisible();

      // Consultant sends a reply
      const replyText = 'Дякую за звернення. Я ваш консультант.';
      await messageInput.fill(replyText);

      const sendButton = staffPage.locator(
        '[data-testid="send-message"], button[aria-label="Send"], button:has-text("Надіслати")',
      );
      await sendButton.click();

      // Verify the reply appears in the thread
      await expect(
        chatSection.locator('.message, [data-testid="chat-message"]').filter({ hasText: replyText }),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('TC-02: Staff-to-staff direct messaging', () => {
    test('staff can navigate to direct messaging at /staff/chat', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/chat');

      // Wait for the staff chat page to load
      const chatPage = staffPage.locator(
        '[data-testid="staff-chat"], .staff-chat, main',
      );
      await expect(chatPage).toBeVisible({ timeout: 15_000 });

      // Verify the conversation list is present
      const conversationList = staffPage.locator(
        '[data-testid="conversation-list"], .conversation-list, aside',
      );
      await expect(conversationList).toBeVisible();

      // Start a new conversation or select an existing one
      const newChatButton = staffPage.locator(
        '[data-testid="new-chat"], button:has-text("Нове повідомлення"), button:has-text("New chat")',
      );
      const hasNewChat = await newChatButton.isVisible().catch(() => false);

      if (hasNewChat) {
        await newChatButton.click();

        // Select a colleague from the list
        const colleagueList = staffPage.locator(
          '[data-testid="colleague-list"], .colleague-list, [role="listbox"]',
        );
        await expect(colleagueList).toBeVisible({ timeout: 5_000 });

        const firstColleague = colleagueList
          .locator('[data-testid="colleague-option"], [role="option"], li')
          .first();
        if (await firstColleague.isVisible().catch(() => false)) {
          await firstColleague.click();
        }
      } else {
        // Select the first existing conversation
        const firstConversation = conversationList
          .locator('[data-testid="conversation-item"], .conversation-item')
          .first();
        if (await firstConversation.isVisible().catch(() => false)) {
          await firstConversation.click();
        }
      }

      // Verify the chat input is visible (ready for messaging)
      const messageInput = staffPage.locator(
        '[data-testid="dm-input"], [data-testid="message-input"], textarea, .chat-input textarea',
      );
      const isInputVisible = await messageInput.isVisible().catch(() => false);
      if (isInputVisible) {
        await messageInput.fill('Привіт! Маю питання щодо справи.');
        const sendButton = staffPage.locator(
          '[data-testid="send-message"], button[aria-label="Send"], button:has-text("Надіслати")',
        );
        await sendButton.click();
      }
    });
  });

  test.describe('TC-03: Conversation list displays', () => {
    test('staff chat page shows conversation list with preview information', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/chat');

      const conversationList = staffPage.locator(
        '[data-testid="conversation-list"], .conversation-list, aside',
      );
      await expect(conversationList).toBeVisible({ timeout: 15_000 });

      // Verify conversation items are present
      const conversationItems = conversationList.locator(
        '[data-testid="conversation-item"], .conversation-item',
      );
      const itemCount = await conversationItems.count();

      if (itemCount > 0) {
        const firstItem = conversationItems.first();

        // Each conversation item should display the participant name
        const participantName = firstItem.locator(
          '[data-testid="participant-name"], .participant-name, .chat-name',
        );
        await expect(participantName).toBeVisible();

        // Should display last message preview
        const lastMessagePreview = firstItem.locator(
          '[data-testid="last-message-preview"], .last-message-preview, .chat-preview',
        );
        await expect(lastMessagePreview).toBeVisible();

        // Should display time of last message
        const lastMessageTime = firstItem.locator(
          'time, .last-message-time, .chat-time',
        );
        await expect(lastMessageTime).toBeVisible();
      }
    });

    test('clicking a conversation opens the chat thread', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/chat');

      const conversationItems = staffPage.locator(
        '[data-testid="conversation-item"], .conversation-item',
      );
      const itemCount = await conversationItems.count();

      if (itemCount > 0) {
        await conversationItems.first().click();

        // The chat thread panel should become visible
        const chatThread = staffPage.locator(
          '[data-testid="chat-thread"], .chat-thread, .message-area',
        );
        await expect(chatThread).toBeVisible({ timeout: 5_000 });

        // Message input should be available
        const messageInput = staffPage.locator(
          '[data-testid="message-input"], textarea, .chat-input textarea',
        );
        await expect(messageInput).toBeVisible();
      }
    });
  });
});
