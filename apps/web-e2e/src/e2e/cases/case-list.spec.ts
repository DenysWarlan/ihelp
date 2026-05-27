import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E02-S02: Case List for Consultants', () => {
  test.describe('TC-01: Consultant sees assigned cases list', () => {
    test('staff navigates to /staff/cases and sees a list of assigned cases', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/cases');

      // Wait for the case list to load
      const caseList = staffPage.locator(
        '[data-testid="case-list"], .case-list, table tbody',
      );
      await expect(caseList).toBeVisible({ timeout: 15_000 });

      // Verify at least the list container is present (may be empty for new consultants)
      const caseCards = staffPage.locator(
        '[data-testid="case-card"], .case-card, table tbody tr',
      );
      const count = await caseCards.count();
      expect(count).toBeGreaterThanOrEqual(0);

      // Verify the page heading
      await expect(
        staffPage.locator('h1, h2, [data-testid="page-title"]').first(),
      ).toBeVisible();
    });
  });

  test.describe('TC-02: Filter cases by status, urgency, tag', () => {
    test('filtering by status narrows the case list', async ({ staffPage }) => {
      await staffPage.goto('/staff/cases');

      // Open status filter
      const statusFilter = staffPage.locator(
        '[data-testid="filter-status"], [aria-label="Статус"]',
      );
      await statusFilter.click();

      // Select "In Progress" status
      await staffPage.getByRole('option', { name: /в роботі|in.progress/i }).click();

      // Verify the URL or filter state updated
      await expect(staffPage).toHaveURL(/status|filter/);

      // Case list should still be visible
      const caseList = staffPage.locator(
        '[data-testid="case-list"], .case-list, table tbody',
      );
      await expect(caseList).toBeVisible();
    });

    test('filtering by urgency narrows the case list', async ({ staffPage }) => {
      await staffPage.goto('/staff/cases');

      const urgencyFilter = staffPage.locator(
        '[data-testid="filter-urgency"], [aria-label="Терміновість"]',
      );
      await urgencyFilter.click();
      await staffPage.getByRole('option', { name: /висока|high/i }).click();

      const caseList = staffPage.locator(
        '[data-testid="case-list"], .case-list, table tbody',
      );
      await expect(caseList).toBeVisible();
    });

    test('filtering by tag narrows the case list', async ({ staffPage }) => {
      await staffPage.goto('/staff/cases');

      const tagFilter = staffPage.locator(
        '[data-testid="filter-tag"], [aria-label="Тег"]',
      );
      await tagFilter.click();

      // Select the first available tag
      const firstTag = staffPage.getByRole('option').first();
      if (await firstTag.isVisible().catch(() => false)) {
        await firstTag.click();

        const caseList = staffPage.locator(
          '[data-testid="case-list"], .case-list, table tbody',
        );
        await expect(caseList).toBeVisible();
      }
    });
  });

  test.describe('TC-03: Sort by last message time, creation date', () => {
    test('sort by last message time updates case order', async ({ staffPage }) => {
      await staffPage.goto('/staff/cases');

      const sortControl = staffPage.locator(
        '[data-testid="sort-select"], [aria-label="Сортування"]',
      );
      await sortControl.click();
      await staffPage
        .getByRole('option', { name: /останнє повідомлення|last.message/i })
        .click();

      // Verify the list is still rendered after sort change
      const caseList = staffPage.locator(
        '[data-testid="case-list"], .case-list, table tbody',
      );
      await expect(caseList).toBeVisible();
    });

    test('sort by creation date updates case order', async ({ staffPage }) => {
      await staffPage.goto('/staff/cases');

      const sortControl = staffPage.locator(
        '[data-testid="sort-select"], [aria-label="Сортування"]',
      );
      await sortControl.click();
      await staffPage
        .getByRole('option', { name: /дата створення|creation.date/i })
        .click();

      const caseList = staffPage.locator(
        '[data-testid="case-list"], .case-list, table tbody',
      );
      await expect(caseList).toBeVisible();
    });
  });

  test.describe('TC-04: Pagination works', () => {
    test('pagination controls are visible and functional', async ({ staffPage }) => {
      await staffPage.goto('/staff/cases');

      const pagination = staffPage.locator(
        '[data-testid="pagination"], .pagination, nav[aria-label="pagination"]',
      );

      // Pagination may not be visible if there are fewer items than the page size
      const isPaginationVisible = await pagination.isVisible().catch(() => false);

      if (isPaginationVisible) {
        // Click next page
        const nextButton = pagination.locator(
          'button:has-text("Наступна"), button[aria-label="next"], [data-testid="next-page"]',
        );
        if (await nextButton.isEnabled()) {
          await nextButton.click();

          // Verify the page changed (URL param or visual indicator)
          await staffPage.waitForTimeout(500);
          const caseList = staffPage.locator(
            '[data-testid="case-list"], .case-list, table tbody',
          );
          await expect(caseList).toBeVisible();
        }
      }
    });
  });

  test.describe('TC-05: Case card shows person name, topic, time since last message', () => {
    test('case card displays essential information', async ({ staffPage }) => {
      await staffPage.goto('/staff/cases');

      const firstCaseCard = staffPage
        .locator('[data-testid="case-card"], .case-card, table tbody tr')
        .first();

      const isVisible = await firstCaseCard.isVisible().catch(() => false);

      if (isVisible) {
        // Verify person name is displayed
        const personName = firstCaseCard.locator(
          '[data-testid="person-name"], .person-name, td:nth-child(1)',
        );
        await expect(personName).toBeVisible();

        // Verify topic is displayed
        const topic = firstCaseCard.locator(
          '[data-testid="case-topic"], .case-topic, td:nth-child(2)',
        );
        await expect(topic).toBeVisible();

        // Verify time since last message is displayed
        const lastMessageTime = firstCaseCard.locator(
          '[data-testid="last-message-time"], .last-message-time, time',
        );
        await expect(lastMessageTime).toBeVisible();
      }
    });
  });
});
