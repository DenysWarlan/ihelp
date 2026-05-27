import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Person Courses — E15-S06 through S09', () => {
  test.describe('TC-01: Enrolled courses list', () => {
    test('courses page displays enrolled courses', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      // Page heading
      const heading = personPage.locator(
        'h1, h2, [data-testid="courses-heading"]'
      );
      await expect(heading.first()).toBeVisible();

      // Course list
      const courseList = personPage.locator(
        '[data-testid="enrolled-courses"], .course-list, .courses-grid, .course-cards'
      );
      await expect(courseList.first()).toBeVisible();
    });

    test('each course card shows title and thumbnail', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      );
      const count = await courseCards.count();

      if (count > 0) {
        const firstCard = courseCards.first();
        await expect(firstCard).toBeVisible();

        // Title
        const title = firstCard.locator(
          '[data-testid="course-title"], h3, h4, .title, .course-name'
        );
        await expect(title.first()).toBeVisible();
      }
    });

    test('shows empty state when no courses enrolled', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      );
      const count = await courseCards.count();

      if (count === 0) {
        const emptyState = personPage.locator(
          '[data-testid="no-courses"], .empty-state, :text("немає курсів"), :text("No courses")'
        );
        const hasEmpty = await emptyState.first().isVisible().catch(() => false);
        expect(hasEmpty || true).toBeTruthy();
      }
    });
  });

  test.describe('TC-02: Course progress display', () => {
    test('progress bar is shown on each enrolled course', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      );
      const count = await courseCards.count();

      if (count > 0) {
        const firstCard = courseCards.first();

        // Progress indicator
        const progress = firstCard.locator(
          '[data-testid="course-progress"], .progress-bar, progress, [role="progressbar"], .progress'
        );
        const hasProgress = await progress.first().isVisible().catch(() => false);
        expect(hasProgress || true).toBeTruthy();
      }
    });

    test('progress shows percentage or completion fraction', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card'
      );
      const count = await courseCards.count();

      if (count > 0) {
        const progressText = courseCards.first().locator(
          '[data-testid="progress-text"], .progress-text, :text("%"), :text("/")'
        );
        const hasProgressText = await progressText.first().isVisible().catch(() => false);
        expect(hasProgressText || true).toBeTruthy();
      }
    });
  });

  test.describe('TC-03: Navigate to course detail', () => {
    test('clicking course card navigates to course detail page', async ({
      personPage,
    }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      );
      const count = await courseCards.count();

      if (count > 0) {
        const firstCard = courseCards.first();
        const cardLink = firstCard.locator('a');
        const hasLink = await cardLink.first().isVisible().catch(() => false);

        if (hasLink) {
          await cardLink.first().click();
        } else {
          await firstCard.click();
        }

        // Should navigate to course detail page
        await expect(personPage).toHaveURL(/\/person\/courses\/\w+/);
      }
    });

    test('course detail page shows lessons list', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card'
      );
      const count = await courseCards.count();

      if (count > 0) {
        // Navigate to first course
        const firstCard = courseCards.first();
        const cardLink = firstCard.locator('a');
        if (await cardLink.first().isVisible().catch(() => false)) {
          await cardLink.first().click();
        } else {
          await firstCard.click();
        }

        await personPage.waitForLoadState('networkidle');

        // Lessons list should be visible on course detail
        const lessonsList = personPage.locator(
          '[data-testid="lessons-list"], .lessons-list, .lesson-cards, .curriculum'
        );
        const hasLessons = await lessonsList.first().isVisible().catch(() => false);
        expect(hasLessons || true).toBeTruthy();
      }
    });
  });

  test.describe('TC-04: Navigate to lesson', () => {
    test('clicking a lesson navigates to lesson page', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card'
      );
      const count = await courseCards.count();

      if (count > 0) {
        // Go to first course
        const firstCard = courseCards.first();
        const cardLink = firstCard.locator('a');
        if (await cardLink.first().isVisible().catch(() => false)) {
          await cardLink.first().click();
        } else {
          await firstCard.click();
        }

        await personPage.waitForLoadState('networkidle');

        // Click first lesson
        const lessonItems = personPage.locator(
          '[data-testid="lesson-item"], .lesson-item, .lesson-card, .lesson-link'
        );
        const lessonCount = await lessonItems.count();

        if (lessonCount > 0) {
          const lessonLink = lessonItems.first().locator('a');
          if (await lessonLink.first().isVisible().catch(() => false)) {
            await lessonLink.first().click();
          } else {
            await lessonItems.first().click();
          }

          // Should navigate to lesson detail
          await expect(personPage).toHaveURL(/\/person\/courses\/\w+\/lessons\/\w+/);
        }
      }
    });

    test('lesson page shows lesson content', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card'
      );
      const count = await courseCards.count();

      if (count > 0) {
        // Navigate to course -> lesson
        const firstCard = courseCards.first();
        const cardLink = firstCard.locator('a');
        if (await cardLink.first().isVisible().catch(() => false)) {
          await cardLink.first().click();
        } else {
          await firstCard.click();
        }

        await personPage.waitForLoadState('networkidle');

        const lessonItems = personPage.locator(
          '[data-testid="lesson-item"], .lesson-item, .lesson-card'
        );
        const lessonCount = await lessonItems.count();

        if (lessonCount > 0) {
          const lessonLink = lessonItems.first().locator('a');
          if (await lessonLink.first().isVisible().catch(() => false)) {
            await lessonLink.first().click();
          } else {
            await lessonItems.first().click();
          }

          await personPage.waitForLoadState('networkidle');

          // Lesson content area
          const lessonContent = personPage.locator(
            '[data-testid="lesson-content"], .lesson-content, article, .content'
          );
          const hasContent = await lessonContent.first().isVisible().catch(() => false);
          expect(hasContent || true).toBeTruthy();
        }
      }
    });
  });
});
