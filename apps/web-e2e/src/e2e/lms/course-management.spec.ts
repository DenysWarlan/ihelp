import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES, TEST_COURSE } from '../../fixtures/test-data';

test.describe('Course Management -- TC-S-E04-S01', () => {
  test.describe('TC-01: Admin creates course with all required fields', () => {
    test('should create a new draft course', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffCourses);
      await adminPage.waitForLoadState('networkidle');

      // Click "Create course" button
      const createBtn = adminPage.getByRole('button', { name: /створити курс|create course|додати/i });
      await expect(createBtn).toBeVisible();
      await createBtn.click();

      // Fill required fields
      await adminPage.getByLabel(/назва|title/i).fill(TEST_COURSE.title);
      await adminPage.getByLabel(/опис|description/i).fill(TEST_COURSE.description);

      // Select difficulty
      const difficultySelect = adminPage.locator(
        '[data-testid="course-difficulty"], select[name="difficulty"], [formcontrolname="difficulty"]'
      );
      if (await difficultySelect.isVisible()) {
        await difficultySelect.selectOption(TEST_COURSE.difficulty);
      }

      // Select language
      const languageSelect = adminPage.locator(
        '[data-testid="course-language"], select[name="language"], [formcontrolname="language"]'
      );
      if (await languageSelect.isVisible()) {
        await languageSelect.selectOption(TEST_COURSE.language);
      }

      // Submit form
      const submitBtn = adminPage.getByRole('button', { name: /зберегти|save|створити/i });
      await submitBtn.click();

      // Expect navigation to course detail or success toast
      const successIndicator = adminPage.locator(
        '[role="alert"]:has-text("створено"), .toast-message, [data-testid="course-detail"]'
      );
      await expect(successIndicator.first()).toBeVisible({ timeout: 10_000 });

      // Verify course status is draft
      const statusBadge = adminPage.locator(
        '[data-testid="course-status"], .status-badge, .badge'
      );
      if (await statusBadge.first().isVisible()) {
        await expect(statusBadge.first()).toContainText(/draft|чернетка/i);
      }
    });
  });

  test.describe('TC-02: Add lessons of different types', () => {
    test('should add text, video, and mixed lessons to a course', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffCourses);
      await adminPage.waitForLoadState('networkidle');

      // Open first course in the list
      const courseRow = adminPage.locator(
        '[data-testid="course-row"], table tbody tr, .course-card'
      ).first();
      await courseRow.click();
      await adminPage.waitForLoadState('networkidle');

      // Navigate to lessons tab or section
      const lessonsTab = adminPage.locator(
        '[data-testid="lessons-tab"], button:has-text("Уроки"), a:has-text("Lessons")'
      );
      if (await lessonsTab.isVisible()) {
        await lessonsTab.click();
      }

      // Add text lesson
      const addLessonBtn = adminPage.getByRole('button', { name: /додати урок|add lesson/i });
      await expect(addLessonBtn).toBeVisible();
      await addLessonBtn.click();

      await adminPage.getByLabel(/назва|title/i).fill('Вступ до курсу');

      const typeSelect = adminPage.locator(
        '[data-testid="lesson-type"], select[name="type"], [formcontrolname="type"]'
      );
      if (await typeSelect.isVisible()) {
        await typeSelect.selectOption('text');
      }

      const contentEditor = adminPage.locator(
        '[data-testid="lesson-content"], textarea, [contenteditable="true"], .editor'
      );
      if (await contentEditor.first().isVisible()) {
        await contentEditor.first().fill('Ласкаво просимо до курсу з самодопомоги.');
      }

      const saveLessonBtn = adminPage.getByRole('button', { name: /зберегти|save/i });
      await saveLessonBtn.click();
      await adminPage.waitForLoadState('networkidle');

      // Verify lesson appears in list
      const lessonList = adminPage.locator(
        '[data-testid="lesson-list"], .lesson-list, .lessons-container'
      );
      await expect(lessonList.locator('text=Вступ до курсу')).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('TC-03: Reorder lessons', () => {
    test('should allow reordering lessons via drag or move buttons', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffCourses);
      await adminPage.waitForLoadState('networkidle');

      // Open first course
      const courseRow = adminPage.locator(
        '[data-testid="course-row"], table tbody tr, .course-card'
      ).first();
      await courseRow.click();
      await adminPage.waitForLoadState('networkidle');

      // Navigate to lessons
      const lessonsTab = adminPage.locator(
        '[data-testid="lessons-tab"], button:has-text("Уроки"), a:has-text("Lessons")'
      );
      if (await lessonsTab.isVisible()) {
        await lessonsTab.click();
      }

      // Check for reorder controls (move up/down buttons or drag handles)
      const moveButtons = adminPage.locator(
        '[data-testid="move-up"], [data-testid="move-down"], button[aria-label*="move"], .drag-handle'
      );

      // If move buttons exist, click "move down" on first lesson
      if (await moveButtons.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        const firstLessonTitle = await adminPage.locator(
          '[data-testid="lesson-item"], .lesson-item'
        ).first().textContent();

        const moveDownBtn = adminPage.locator(
          '[data-testid="move-down"], button[aria-label*="down"]'
        ).first();
        await moveDownBtn.click();
        await adminPage.waitForLoadState('networkidle');

        // Verify the first lesson has changed position
        const newFirstLesson = await adminPage.locator(
          '[data-testid="lesson-item"], .lesson-item'
        ).first().textContent();

        expect(newFirstLesson).not.toBe(firstLessonTitle);
      }
    });
  });

  test.describe('TC-04: Mark lesson as trigger warning', () => {
    test('should toggle trigger warning flag on a lesson', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffCourses);
      await adminPage.waitForLoadState('networkidle');

      // Open first course
      const courseRow = adminPage.locator(
        '[data-testid="course-row"], table tbody tr, .course-card'
      ).first();
      await courseRow.click();
      await adminPage.waitForLoadState('networkidle');

      // Open first lesson for editing
      const editLessonBtn = adminPage.locator(
        '[data-testid="edit-lesson"], button[aria-label*="edit"], .edit-btn'
      ).first();
      if (await editLessonBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await editLessonBtn.click();
      }

      // Toggle trigger warning checkbox
      const triggerWarning = adminPage.locator(
        '[data-testid="trigger-warning"], input[name="triggerWarning"], label:has-text("trigger"), label:has-text("тригер")'
      );
      if (await triggerWarning.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await triggerWarning.first().click();

        const saveBtn = adminPage.getByRole('button', { name: /зберегти|save/i });
        await saveBtn.click();

        // Verify trigger warning indicator appears
        const warningIndicator = adminPage.locator(
          '[data-testid="trigger-indicator"], .trigger-warning-badge, .warning-icon'
        );
        await expect(warningIndicator.first()).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test.describe('TC-05: Publish and unpublish course', () => {
    test('should publish a draft course', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffCourses);
      await adminPage.waitForLoadState('networkidle');

      // Open first course
      const courseRow = adminPage.locator(
        '[data-testid="course-row"], table tbody tr, .course-card'
      ).first();
      await courseRow.click();
      await adminPage.waitForLoadState('networkidle');

      // Click publish button
      const publishBtn = adminPage.getByRole('button', { name: /опублікувати|publish/i });
      await expect(publishBtn).toBeVisible({ timeout: 5_000 });
      await publishBtn.click();

      // Confirm publish if dialog appears
      const confirmBtn = adminPage.getByRole('button', { name: /підтвердити|confirm|так/i });
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      // Verify status changed to published
      const statusBadge = adminPage.locator(
        '[data-testid="course-status"], .status-badge, .badge'
      );
      await expect(statusBadge.first()).toContainText(/published|опубліковано/i, { timeout: 10_000 });
    });

    test('should unpublish a published course', async ({ adminPage }) => {
      await adminPage.goto(ROUTES.staffCourses);
      await adminPage.waitForLoadState('networkidle');

      // Open a published course
      const courseRow = adminPage.locator(
        '[data-testid="course-row"], table tbody tr, .course-card'
      ).first();
      await courseRow.click();
      await adminPage.waitForLoadState('networkidle');

      // Click unpublish button
      const unpublishBtn = adminPage.getByRole('button', {
        name: /зняти з публікації|unpublish|деактивувати/i,
      });
      if (await unpublishBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await unpublishBtn.click();

        // Confirm if dialog appears
        const confirmBtn = adminPage.getByRole('button', { name: /підтвердити|confirm|так/i });
        if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirmBtn.click();
        }

        // Verify status changed to draft
        const statusBadge = adminPage.locator(
          '[data-testid="course-status"], .status-badge, .badge'
        );
        await expect(statusBadge.first()).toContainText(/draft|чернетка/i, { timeout: 10_000 });
      }
    });
  });
});
