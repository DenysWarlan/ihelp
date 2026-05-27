import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E02-S07: Case Tags', () => {
  const CASE_ID = 'test-case-001';
  const TEST_TAG_NAME = `e2e-tag-${Date.now()}`;

  test.describe('TC-01: Admin creates tag', () => {
    test('admin navigates to tag management and creates a new tag', async ({
      adminPage,
    }) => {
      await adminPage.goto('/admin/tags');

      // Wait for the tag management page to load
      const tagManagement = adminPage.locator(
        '[data-testid="tag-management"], .tag-management, main',
      );
      await expect(tagManagement).toBeVisible({ timeout: 15_000 });

      // Click create tag button
      const createButton = adminPage.locator(
        '[data-testid="create-tag"], button:has-text("Створити тег"), button:has-text("Create tag")',
      );
      await createButton.click();

      // Fill in tag name
      const tagNameInput = adminPage.locator(
        '[data-testid="tag-name-input"], input[name="name"], input[placeholder*="тег"]',
      );
      await expect(tagNameInput).toBeVisible({ timeout: 5_000 });
      await tagNameInput.fill(TEST_TAG_NAME);

      // Select a tag color (optional)
      const colorPicker = adminPage.locator(
        '[data-testid="tag-color"], .color-picker, input[type="color"]',
      );
      if (await colorPicker.isVisible().catch(() => false)) {
        await colorPicker.click();
        // Select a predefined color or use the first swatch
        const firstColor = adminPage
          .locator('.color-swatch, [data-testid="color-option"]')
          .first();
        if (await firstColor.isVisible().catch(() => false)) {
          await firstColor.click();
        }
      }

      // Save the tag
      const saveButton = adminPage.getByRole('button', {
        name: /зберегти|save|створити|create/i,
      });
      await saveButton.click();

      // Verify the tag appears in the list
      const tagList = adminPage.locator(
        '[data-testid="tag-list"], .tag-list',
      );
      await expect(tagList).toContainText(TEST_TAG_NAME, { timeout: 5_000 });
    });
  });

  test.describe('TC-02: Assign tag to case', () => {
    test('staff assigns a tag to an existing case', async ({ staffPage }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}`);
      await staffPage.waitForLoadState('networkidle');

      // Open the tags section or tag assignment control
      const addTagButton = staffPage.locator(
        '[data-testid="add-tag"], button:has-text("Додати тег"), button:has-text("Add tag"), .tag-add-btn',
      );
      await expect(addTagButton).toBeVisible({ timeout: 15_000 });
      await addTagButton.click();

      // Wait for tag selection dropdown
      const tagDropdown = staffPage.locator(
        '[data-testid="tag-dropdown"], .tag-dropdown, [role="listbox"]',
      );
      await expect(tagDropdown).toBeVisible({ timeout: 5_000 });

      // Select the first available tag
      const tagOption = tagDropdown
        .locator('[data-testid="tag-option"], [role="option"], li')
        .first();
      await tagOption.click();

      // Verify the tag is now associated with the case
      const caseTags = staffPage.locator(
        '[data-testid="case-tags"], .case-tags',
      );
      await expect(caseTags).toBeVisible({ timeout: 5_000 });
      const tagCount = await caseTags
        .locator('[data-testid="tag-badge"], .tag-badge, .badge')
        .count();
      expect(tagCount).toBeGreaterThan(0);
    });
  });

  test.describe('TC-03: Filter cases by tag', () => {
    test('staff filters the case list by a specific tag', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/cases');

      // Open the tag filter
      const tagFilter = staffPage.locator(
        '[data-testid="filter-tag"], [aria-label="Тег"], button:has-text("Тег")',
      );
      await expect(tagFilter).toBeVisible({ timeout: 15_000 });
      await tagFilter.click();

      // Select a tag from the filter options
      const filterOption = staffPage
        .locator('[data-testid="tag-filter-option"], [role="option"]')
        .first();

      const hasOptions = await filterOption.isVisible().catch(() => false);

      if (hasOptions) {
        const tagText = await filterOption.textContent();
        await filterOption.click();

        // Wait for the filtered results
        await staffPage.waitForTimeout(1_000);

        // Verify the case list updated
        const caseList = staffPage.locator(
          '[data-testid="case-list"], .case-list, table tbody',
        );
        await expect(caseList).toBeVisible();

        // If there are results, verify they contain the selected tag
        const firstCaseCard = staffPage
          .locator('[data-testid="case-card"], .case-card, table tbody tr')
          .first();
        if (await firstCaseCard.isVisible().catch(() => false)) {
          const cardTags = firstCaseCard.locator(
            '[data-testid="tag-badge"], .tag-badge, .badge',
          );
          if (tagText) {
            await expect(cardTags).toContainText(tagText.trim());
          }
        }
      }
    });
  });
});
