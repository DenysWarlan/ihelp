import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('App Shell — E16-S01', () => {
  test.describe('TC-01: Lazy-loaded routes — navigation works between zones', () => {
    test('navigating from public to person zone loads correctly', async ({
      personPage,
    }) => {
      // Start at public landing
      await personPage.goto(ROUTES.home);
      await personPage.waitForLoadState('networkidle');

      // Navigate to person zone
      await personPage.goto(ROUTES.personHome);
      await personPage.waitForLoadState('networkidle');

      // Person zone should load (no blank page or error)
      const content = personPage.locator('main, [data-testid="person-dashboard"], .dashboard');
      await expect(content.first()).toBeVisible();
    });

    test('navigating from person zone to staff zone loads correctly', async ({
      staffPage,
    }) => {
      // Navigate to staff zone
      await staffPage.goto(ROUTES.staffDashboard);
      await staffPage.waitForLoadState('networkidle');

      // Staff zone should load
      const content = staffPage.locator('main, [data-testid="staff-dashboard"], .dashboard');
      await expect(content.first()).toBeVisible();
    });

    test('navigating between public routes works', async ({ publicPage }) => {
      await publicPage.goto(ROUTES.home);
      await publicPage.waitForLoadState('networkidle');

      // Navigate to catalog
      const coursesLink = publicPage.getByRole('link', { name: /курс/i });
      const hasCoursesLink = await coursesLink.first().isVisible().catch(() => false);

      if (hasCoursesLink) {
        await coursesLink.first().click();
        await expect(publicPage).toHaveURL(/\/catalog/);
        await publicPage.waitForLoadState('networkidle');

        // Catalog should be visible
        const content = publicPage.locator('main, [data-testid="catalog"], .catalog');
        await expect(content.first()).toBeVisible();
      }
    });

    test('back navigation works between lazy-loaded zones', async ({ personPage }) => {
      await personPage.goto(ROUTES.personHome);
      await personPage.waitForLoadState('networkidle');

      // Navigate to courses
      await personPage.goto(ROUTES.personCourses);
      await personPage.waitForLoadState('networkidle');

      // Go back
      await personPage.goBack();
      await personPage.waitForLoadState('networkidle');

      await expect(personPage).toHaveURL(/\/person$/);
    });
  });

  test.describe('TC-02: Auth guard redirects unauthenticated users to /login', () => {
    test('/person redirects unauthenticated user to /login', async ({ publicPage }) => {
      await publicPage.goto(ROUTES.personHome);
      await publicPage.waitForLoadState('networkidle');

      await expect(publicPage).toHaveURL(/\/login/);
    });

    test('/staff redirects unauthenticated user to /login', async ({ publicPage }) => {
      await publicPage.goto(ROUTES.staffDashboard);
      await publicPage.waitForLoadState('networkidle');

      // Should redirect to login or staff login
      const url = publicPage.url();
      expect(url).toMatch(/\/login|\/staff\/login/);
    });

    test('/person/profile redirects unauthenticated user to /login', async ({
      publicPage,
    }) => {
      await publicPage.goto(ROUTES.personProfile);
      await publicPage.waitForLoadState('networkidle');

      await expect(publicPage).toHaveURL(/\/login/);
    });

    test('/staff/analytics redirects unauthenticated user to /login', async ({
      publicPage,
    }) => {
      await publicPage.goto(ROUTES.staffAnalytics);
      await publicPage.waitForLoadState('networkidle');

      const url = publicPage.url();
      expect(url).toMatch(/\/login/);
    });
  });

  test.describe('TC-03: Public layout', () => {
    test('public pages show navbar with logo, courses link, and login button', async ({
      publicPage,
    }) => {
      await publicPage.goto(ROUTES.home);
      await publicPage.waitForLoadState('networkidle');

      // Logo
      const logo = publicPage.locator(
        '[data-testid="logo"], header a[href="/"], .logo, img[alt*="logo" i]'
      );
      await expect(logo.first()).toBeVisible();

      // Courses link
      const coursesLink = publicPage.locator(
        'a[href*="/catalog"], :text("Курси"), header a:has-text("Курси")'
      );
      await expect(coursesLink.first()).toBeVisible();

      // Login button
      const loginBtn = publicPage.locator(
        'a[href*="/login"], button:has-text("Увійти"), [data-testid="login-button"]'
      );
      await expect(loginBtn.first()).toBeVisible();
    });

    test('public navbar does not show sidebar or user menu', async ({ publicPage }) => {
      await publicPage.goto(ROUTES.home);
      await publicPage.waitForLoadState('networkidle');

      // Sidebar should NOT be present on public pages
      const sidebar = publicPage.locator(
        '[data-testid="staff-sidebar"], .staff-sidebar, aside.sidebar'
      );
      await expect(sidebar).toHaveCount(0);

      // User menu should NOT be present
      const userMenu = publicPage.locator(
        '[data-testid="user-menu"], .user-menu, .avatar-menu'
      );
      await expect(userMenu).toHaveCount(0);
    });
  });
});
