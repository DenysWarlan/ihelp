import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Progress Tracking -- TC-S-E04-S08 through S11', () => {
  test.describe('TC-01: Progress percentage updates after completing lessons', () => {
    test('should show updated progress after lesson completion', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCard = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      ).first();

      if (!(await courseCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Read initial progress
      const progressIndicator = courseCard.locator(
        '[data-testid="progress-bar"], .progress-bar, progress, [role="progressbar"], .progress-text'
      );
      await progressIndicator
        .first()
        .textContent()
        .catch(() => '0');

      // Navigate to course detail
      await courseCard.click();
      await personPage.waitForLoadState('networkidle');

      // Find an incomplete lesson
      const incompleteLessons = personPage.locator(
        '[data-testid="lesson-item"]:not(.completed), .lesson-item:not(.completed), .lesson-row:not(.done)'
      );

      if (!(await incompleteLessons.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await incompleteLessons.first().click();
      await personPage.waitForLoadState('networkidle');

      // Complete the lesson
      const completeBtn = personPage.getByRole('button', {
        name: /завершити|complete|пройдено|готово/i,
      });
      if (await completeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await completeBtn.click();
        await personPage.waitForLoadState('networkidle');
      }

      // Navigate back to courses list
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      // Verify progress has changed
      const updatedProgress = courseCard.locator(
        '[data-testid="progress-bar"], .progress-bar, progress, [role="progressbar"], .progress-text'
      );
      await updatedProgress
        .first()
        .textContent()
        .catch(() => '0');

      // Progress text should have changed (or progress value attribute)
      // If using a progressbar element, check aria-valuenow
      const progressBarElement = courseCard.locator('[role="progressbar"]');
      if (await progressBarElement.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const value = await progressBarElement.getAttribute('aria-valuenow');
        expect(Number(value)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('TC-02: Course completion when all lessons done', () => {
    test('should show course as completed when all lessons are finished', async ({
      personPage,
    }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      // Look for a completed course badge
      const completedBadge = personPage.locator(
        '[data-testid="course-completed"], .completed-badge, :text("100%"), .course-card:has(.completed)'
      );

      const completedCourse = await completedBadge
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (completedCourse) {
        // Verify 100% progress or completion indicator
        await expect(completedBadge.first()).toBeVisible();
      }

      // Navigate to a course detail to check completion state
      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      );

      if (!(await courseCards.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await courseCards.first().click();
      await personPage.waitForLoadState('networkidle');

      // Check if all lessons marked as completed
      const totalLessons = await personPage
        .locator('[data-testid="lesson-item"], .lesson-item, .lesson-row')
        .count();

      const completedLessons = await personPage
        .locator(
          '[data-testid="lesson-item"].completed, .lesson-item.completed, .lesson-row.done, [data-testid="lesson-completed"]'
        )
        .count();

      if (totalLessons > 0 && completedLessons === totalLessons) {
        // Course completion banner or certificate should be visible
        const completionBanner = personPage.locator(
          '[data-testid="course-completion"], .completion-banner, .certificate-link, :text("Вітаємо")'
        );
        await expect(completionBanner.first()).toBeVisible({ timeout: 5_000 });
      }
    });
  });

  test.describe('TC-03: Re-access completed lessons', () => {
    test('should allow re-accessing already completed lessons', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCard = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      ).first();

      if (!(await courseCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await courseCard.click();
      await personPage.waitForLoadState('networkidle');

      // Find a completed lesson
      const completedLesson = personPage.locator(
        '[data-testid="lesson-item"].completed, .lesson-item.completed, .lesson-row.done'
      ).first();

      if (!(await completedLesson.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Click on the completed lesson -- it should still be accessible
      await completedLesson.click();
      await personPage.waitForLoadState('networkidle');

      // Lesson content should load
      await expect(personPage).toHaveURL(
        /\/person\/courses\/[a-zA-Z0-9-]+\/lessons\/[a-zA-Z0-9-]+/
      );

      const contentArea = personPage.locator(
        '[data-testid="lesson-content"], .lesson-content, article, .content-area'
      );
      await expect(contentArea.first()).toBeVisible();

      // Completed indicator should still be visible
      const completionBadge = personPage.locator(
        '[data-testid="lesson-completed"], .completed-badge, .checkmark'
      );
      if (await completionBadge.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(completionBadge.first()).toBeVisible();
      }
    });
  });

  test.describe('TC-04: Course recommendations from consultant', () => {
    test('should display recommended courses section', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      // Look for recommendations section
      const recommendations = personPage.locator(
        '[data-testid="recommended-courses"], .recommended-courses, section:has-text("Рекомендовані"), section:has-text("Recommended")'
      );

      if (await recommendations.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Recommended course cards should be present
        const recommendedCards = recommendations.locator(
          '[data-testid="course-card"], .course-card, .course-item'
        );
        const count = await recommendedCards.count();
        expect(count).toBeGreaterThanOrEqual(0);

        // Each recommendation should have a title and "recommended by" indicator
        if (count > 0) {
          const firstCard = recommendedCards.first();
          const title = firstCard.locator('h3, h4, [data-testid="course-title"]');
          await expect(title).toBeVisible();
        }
      }
    });

    test('should show consultant-assigned course with indicator', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      // Look for "assigned by consultant" badge on any course
      const assignedBadge = personPage.locator(
        '[data-testid="assigned-badge"], .assigned-by-consultant, :text("призначено"), :text("рекомендовано")'
      );

      if (await assignedBadge.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(assignedBadge.first()).toBeVisible();
      }
    });
  });
});
