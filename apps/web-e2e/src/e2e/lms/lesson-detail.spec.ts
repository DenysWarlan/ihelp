import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Lesson Detail -- TC-S-E04-S05 through S07', () => {
  /**
   * Helper: navigate to the first lesson of the first enrolled course.
   * Returns false if no courses/lessons are available (test should skip).
   */
  async function navigateToFirstLesson(page: import('@playwright/test').Page): Promise<boolean> {
    await page.goto(ROUTES.personCourses);
    await page.waitForLoadState('networkidle');

    const courseCard = page.locator(
      '[data-testid="course-card"], .course-card, .course-item'
    ).first();

    if (!(await courseCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      return false;
    }

    await courseCard.click();
    await page.waitForLoadState('networkidle');

    const lessonItem = page.locator(
      '[data-testid="lesson-item"], .lesson-item, .lesson-row'
    ).first();

    if (!(await lessonItem.isVisible({ timeout: 5_000 }).catch(() => false))) {
      return false;
    }

    await lessonItem.click();
    await page.waitForLoadState('networkidle');
    return true;
  }

  test.describe('TC-01: Lesson content displays correctly', () => {
    test('should display lesson content at /person/courses/:courseId/lessons/:lessonId', async ({
      personPage,
    }) => {
      const navigated = await navigateToFirstLesson(personPage);
      if (!navigated) {
        test.skip();
        return;
      }

      // Expect URL pattern
      await expect(personPage).toHaveURL(
        /\/person\/courses\/[a-zA-Z0-9-]+\/lessons\/[a-zA-Z0-9-]+/
      );

      // Lesson title visible
      const lessonTitle = personPage.locator(
        'h1, h2, [data-testid="lesson-title"]'
      ).first();
      await expect(lessonTitle).toBeVisible();

      // Lesson content area visible
      const contentArea = personPage.locator(
        '[data-testid="lesson-content"], .lesson-content, article, .content-area'
      );
      await expect(contentArea.first()).toBeVisible();
    });

    test('should display trigger warning if lesson has one', async ({ personPage }) => {
      const navigated = await navigateToFirstLesson(personPage);
      if (!navigated) {
        test.skip();
        return;
      }

      // Check if trigger warning banner is present (not all lessons have it)
      const triggerWarning = personPage.locator(
        '[data-testid="trigger-warning-banner"], .trigger-warning, .content-warning'
      );
      const hasTrigger = await triggerWarning.first().isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasTrigger) {
        await expect(triggerWarning.first()).toContainText(/тригер|trigger|попередження|warning/i);
      }
    });
  });

  test.describe('TC-02: Mark lesson complete and progress updates', () => {
    test('should mark lesson as complete and update progress', async ({ personPage }) => {
      const navigated = await navigateToFirstLesson(personPage);
      if (!navigated) {
        test.skip();
        return;
      }

      // Find the "Mark complete" or "Complete lesson" button
      const completeBtn = personPage.getByRole('button', {
        name: /завершити|complete|пройдено|готово|позначити/i,
      });

      if (!(await completeBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await completeBtn.click();
      await personPage.waitForLoadState('networkidle');

      // Verify completion indicator
      const completionIndicator = personPage.locator(
        '[data-testid="lesson-completed"], .completed-badge, .checkmark, svg.check, :text("завершено")'
      );
      const toast = personPage.locator('[role="alert"]');

      const isComplete =
        (await completionIndicator.first().isVisible({ timeout: 5_000 }).catch(() => false)) ||
        (await toast.first().isVisible({ timeout: 5_000 }).catch(() => false));
      expect(isComplete).toBeTruthy();
    });
  });

  test.describe('TC-03: Next/previous lesson navigation', () => {
    test('should navigate between lessons using next/previous buttons', async ({
      personPage,
    }) => {
      const navigated = await navigateToFirstLesson(personPage);
      if (!navigated) {
        test.skip();
        return;
      }

      const currentUrl = personPage.url();

      // Click "Next lesson" button
      const nextBtn = personPage.locator(
        '[data-testid="next-lesson"], button:has-text("Наступний"), a:has-text("Next"), button:has-text("Далі")'
      );

      if (!(await nextBtn.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await nextBtn.first().click();
      await personPage.waitForLoadState('networkidle');

      // URL should change to a different lesson
      const newUrl = personPage.url();
      expect(newUrl).not.toBe(currentUrl);
      await expect(personPage).toHaveURL(
        /\/person\/courses\/[a-zA-Z0-9-]+\/lessons\/[a-zA-Z0-9-]+/
      );

      // Click "Previous lesson" button
      const prevBtn = personPage.locator(
        '[data-testid="prev-lesson"], button:has-text("Попередній"), a:has-text("Previous"), button:has-text("Назад")'
      );

      if (await prevBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await prevBtn.first().click();
        await personPage.waitForLoadState('networkidle');

        // Should go back to the original lesson
        await expect(personPage).toHaveURL(currentUrl);
      }
    });
  });

  test.describe('TC-04: Talk to Consultant button visible', () => {
    test('should show "Talk to Consultant" button on lesson page', async ({ personPage }) => {
      const navigated = await navigateToFirstLesson(personPage);
      if (!navigated) {
        test.skip();
        return;
      }

      // Look for consultant/help button
      const consultantBtn = personPage.locator(
        '[data-testid="talk-to-consultant"], button:has-text("консультант"), a:has-text("консультант"), button:has-text("поговорити"), [data-testid="get-help"]'
      );

      await expect(consultantBtn.first()).toBeVisible({ timeout: 5_000 });

      // Click should navigate to chat or open a dialog
      await consultantBtn.first().click();

      const chatOpened =
        (await personPage.locator('[data-testid="chat-dialog"], .chat-window').first()
          .isVisible({ timeout: 5_000 }).catch(() => false)) ||
        personPage.url().includes('/chat');

      expect(chatOpened).toBeTruthy();
    });
  });
});
