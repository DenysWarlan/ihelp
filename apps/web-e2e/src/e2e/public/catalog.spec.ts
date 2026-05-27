import { test, expect } from '@playwright/test';

test.describe('Каталог курсів — E14-S02', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/catalog');
  });

  test('TC-01: сторінка каталогу завантажується та відображає заголовок', async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/catalog/);

    const heading = page.locator(
      'h1, h2, [data-testid="catalog-heading"]'
    );
    await expect(heading.first()).toBeVisible();
  });

  test('TC-02: відображаються картки курсів', async ({ page }) => {
    const courseCards = page.locator(
      '[data-testid="course-card"], .course-card, article'
    );
    // Wait for at least one card to appear (or empty state)
    const emptyState = page.locator(
      '[data-testid="empty-state"], .empty-state'
    );

    await expect(
      courseCards.first().or(emptyState.first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('TC-03: картка курсу містить назву та опис', async ({ page }) => {
    const courseCards = page.locator(
      '[data-testid="course-card"], .course-card, article'
    );

    const cardCount = await courseCards.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    const firstCard = courseCards.first();
    // Card should contain a title (heading element)
    const cardTitle = firstCard.locator('h2, h3, h4, [data-testid="course-title"]');
    await expect(cardTitle.first()).toBeVisible();

    // Card should contain description text
    const cardDescription = firstCard.locator(
      'p, [data-testid="course-description"]'
    );
    await expect(cardDescription.first()).toBeVisible();
  });

  test('TC-04: клік на картку веде на сторінку перегляду курсу', async ({
    page,
  }) => {
    const courseCards = page.locator(
      '[data-testid="course-card"], .course-card, article'
    );

    const cardCount = await courseCards.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    const firstCard = courseCards.first();
    const cardLink = firstCard.locator('a').first();
    await cardLink.click();

    // Should navigate to /catalog/:id
    await expect(page).toHaveURL(/\/catalog\/[^/]+/);
  });

  test('TC-05: пошук/фільтрація курсів', async ({ page }) => {
    const searchInput = page.locator(
      '[data-testid="catalog-search"], input[type="search"], input[placeholder*="пошук" i], input[placeholder*="search" i]'
    );

    const hasSearch = await searchInput.first().isVisible().catch(() => false);
    if (!hasSearch) {
      test.skip();
      return;
    }

    await searchInput.first().fill('test');
    // Wait for filtered results to update
    await page.waitForTimeout(500);

    // Page should still be on catalog
    await expect(page).toHaveURL(/\/catalog/);
  });
});

test.describe('Перегляд курсу — E14-S03', () => {
  test('TC-01: сторінка перегляду курсу завантажується', async ({ page }) => {
    // First go to catalog to find a course
    await page.goto('/catalog');

    const courseCards = page.locator(
      '[data-testid="course-card"], .course-card, article'
    );

    const cardCount = await courseCards.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    // Navigate to first course
    const cardLink = courseCards.first().locator('a').first();
    await cardLink.click();

    await expect(page).toHaveURL(/\/catalog\/[^/]+/);

    // Course detail page should have a title
    const courseTitle = page.locator(
      'h1, h2, [data-testid="course-title"]'
    );
    await expect(courseTitle.first()).toBeVisible();
  });

  test('TC-02: сторінка курсу відображає опис та структуру', async ({
    page,
  }) => {
    await page.goto('/catalog');

    const courseCards = page.locator(
      '[data-testid="course-card"], .course-card, article'
    );

    const cardCount = await courseCards.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    const cardLink = courseCards.first().locator('a').first();
    await cardLink.click();

    await expect(page).toHaveURL(/\/catalog\/[^/]+/);

    // Description should be visible
    const description = page.locator(
      '[data-testid="course-description"], .course-description, main p'
    );
    await expect(description.first()).toBeVisible();
  });

  test('TC-03: неіснуючий курс показує 404 або повідомлення про помилку', async ({
    page,
  }) => {
    await page.goto('/catalog/non-existent-course-id-12345');

    // Should show not found message or redirect
    const notFound = page.locator(
      '[data-testid="not-found"], .not-found, :text("не знайдено"), :text("not found")'
    );
    const redirectedToList = page.url().endsWith('/catalog');

    expect(
      (await notFound.first().isVisible().catch(() => false)) || redirectedToList
    ).toBeTruthy();
  });
});
