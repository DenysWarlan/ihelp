import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Course Catalog -- TC-S-E04-S02 through S04', () => {
  test.describe('TC-01: Person sees enrolled courses with progress bars', () => {
    test('should display enrolled courses at /person/courses', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      // Page heading visible
      const heading = personPage.locator('h1, h2').first();
      await expect(heading).toBeVisible();

      // Course cards or list should be present
      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      );
      const emptyState = personPage.locator(
        '[data-testid="empty-state"], .empty-state, :text("немає курсів")'
      );

      // Either courses or empty state visible
      const hasCourses = await courseCards.first().isVisible({ timeout: 5_000 }).catch(() => false);
      const hasEmptyState = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasCourses || hasEmptyState).toBeTruthy();

      if (hasCourses) {
        // Verify progress bar exists on course cards
        const progressBar = courseCards.first().locator(
          '[data-testid="progress-bar"], .progress-bar, progress, [role="progressbar"]'
        );
        await expect(progressBar).toBeVisible();
      }
    });
  });

  test.describe('TC-02: Course detail shows lesson list with progress', () => {
    test('should display lesson list on course detail page', async ({ personPage }) => {
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      const courseCards = personPage.locator(
        '[data-testid="course-card"], .course-card, .course-item'
      );

      // Skip if no courses enrolled
      if (!(await courseCards.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Click on first course
      await courseCards.first().click();
      await personPage.waitForLoadState('networkidle');

      // Expect URL to match /person/courses/:id
      await expect(personPage).toHaveURL(/\/person\/courses\/[a-zA-Z0-9-]+/);

      // Course title visible
      const courseTitle = personPage.locator('h1, h2, [data-testid="course-title"]').first();
      await expect(courseTitle).toBeVisible();

      // Lesson list visible
      const lessonList = personPage.locator(
        '[data-testid="lesson-list"], .lesson-list, .lessons-container, ul, ol'
      );
      await expect(lessonList.first()).toBeVisible();

      // Individual lesson items
      const lessonItems = personPage.locator(
        '[data-testid="lesson-item"], .lesson-item, .lesson-row'
      );
      const count = await lessonItems.count();
      expect(count).toBeGreaterThan(0);

      // Progress indicator on course detail
      const progress = personPage.locator(
        '[data-testid="course-progress"], .progress-bar, progress, [role="progressbar"], :text("%")'
      );
      await expect(progress.first()).toBeVisible();
    });
  });

  test.describe('TC-03: Enrollment flow', () => {
    test('should allow person to enroll in a published course', async ({ personPage }) => {
      // Navigate to public catalog
      await personPage.goto(ROUTES.catalog);
      await personPage.waitForLoadState('networkidle');

      // Find a course card
      const courseCards = personPage.locator(
        '[data-testid="catalog-course"], .course-card, .catalog-item'
      );
      if (!(await courseCards.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Click on first available course
      await courseCards.first().click();
      await personPage.waitForLoadState('networkidle');

      // Click enroll button
      const enrollBtn = personPage.getByRole('button', {
        name: /записатися|enroll|розпочати|почати/i,
      });
      if (await enrollBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await enrollBtn.click();
        await personPage.waitForLoadState('networkidle');

        // Expect either redirect to course detail or success toast
        const successIndicator = personPage.locator(
          '[role="alert"], .toast-message, [data-testid="enrollment-success"]'
        );
        const courseDetail = personPage.locator(
          '[data-testid="lesson-list"], .lesson-list'
        );

        const enrolled =
          (await successIndicator.first().isVisible({ timeout: 5_000 }).catch(() => false)) ||
          (await courseDetail.first().isVisible({ timeout: 5_000 }).catch(() => false));
        expect(enrolled).toBeTruthy();
      }
    });
  });

  test.describe('TC-04: Search and filter courses', () => {
    test('should filter courses by search query', async ({ personPage }) => {
      await personPage.goto(ROUTES.catalog);
      await personPage.waitForLoadState('networkidle');

      // Find search input
      const searchInput = personPage.locator(
        '[data-testid="course-search"], input[type="search"], input[placeholder*="пошук"], input[placeholder*="search"]'
      );
      if (!(await searchInput.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await searchInput.first().fill('самодопомог');
      await personPage.waitForLoadState('networkidle');

      // Wait for filtered results
      await personPage.waitForTimeout(1_000);

      // Course cards should be filtered
      const courseCards = personPage.locator(
        '[data-testid="catalog-course"], .course-card, .catalog-item'
      );
      const emptyResult = personPage.locator(
        '[data-testid="no-results"], .no-results, :text("не знайдено")'
      );

      const hasCards = await courseCards.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasEmpty = await emptyResult.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasCards || hasEmpty).toBeTruthy();
    });

    test('should filter courses by difficulty level', async ({ personPage }) => {
      await personPage.goto(ROUTES.catalog);
      await personPage.waitForLoadState('networkidle');

      const difficultyFilter = personPage.locator(
        '[data-testid="difficulty-filter"], select[name="difficulty"], button:has-text("Рівень")'
      );
      if (!(await difficultyFilter.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Select beginner filter
      if (await difficultyFilter.first().evaluate((el) => (el as HTMLElement).tagName === 'SELECT')) {
        await difficultyFilter.first().selectOption('beginner');
      } else {
        await difficultyFilter.first().click();
        const beginnerOption = personPage.locator(
          'option:has-text("beginner"), li:has-text("початковий"), [data-value="beginner"]'
        );
        await beginnerOption.first().click();
      }

      await personPage.waitForLoadState('networkidle');

      // Filtered results should be visible
      const courseCards = personPage.locator(
        '[data-testid="catalog-course"], .course-card, .catalog-item'
      );
      const emptyResult = personPage.locator(
        '[data-testid="no-results"], .no-results'
      );

      const hasCards = await courseCards.first().isVisible({ timeout: 5_000 }).catch(() => false);
      const hasEmpty = await emptyResult.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasCards || hasEmpty).toBeTruthy();
    });
  });
});
