import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Consultant Dashboard', () => {
  test.describe('TC-01: Dashboard layout and navigation cards', () => {
    test('consultant sees dashboard with cases and courses cards', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.consultantDashboard);
      await staffPage.waitForLoadState('networkidle');

      const dashboard = staffPage.locator(
        '.consultant-dashboard, [data-testid="consultant-dashboard"], main',
      );
      await expect(dashboard.first()).toBeVisible({ timeout: 15_000 });

      // Should have navigation cards
      const navCards = staffPage.locator(
        '.consultant-dashboard__link, .nav-card, [data-testid="nav-card"]',
      );
      const count = await navCards.count();
      expect(count).toBeGreaterThanOrEqual(2); // Cases + Courses
    });

    test('cases card navigates to cases list', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.consultantDashboard);
      await staffPage.waitForLoadState('networkidle');

      const casesLink = staffPage.locator(
        'a[href*="cases"], [data-testid="cases-link"]',
      );
      await expect(casesLink.first()).toBeVisible({ timeout: 15_000 });
      await casesLink.first().click();

      await staffPage.waitForURL(/\/cases/);
    });

    test('courses card navigates to person courses', async ({ staffPage }) => {
      await staffPage.goto(ROUTES.consultantDashboard);
      await staffPage.waitForLoadState('networkidle');

      const coursesLink = staffPage.locator(
        'a[href*="courses"], [data-testid="courses-link"]',
      );
      await expect(coursesLink.first()).toBeVisible({ timeout: 15_000 });
      await coursesLink.first().click();

      // Should navigate to person/courses (view-only for consultants)
      await staffPage.waitForURL(/\/person\/courses|\/courses/);
    });
  });
});
