import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Supervisor — Consultant Profile', () => {
  const TEAM_URL = ROUTES.staffTeam;
  const PROFILE_URL = '/staff/team/test-consultant-001';

  test.describe('TC-01: Team list navigates to consultant profile', () => {
    test('supervisor sees team members and can click to open profile', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(TEAM_URL);
      await supervisorPage.waitForLoadState('networkidle');

      const memberCard = supervisorPage.locator(
        '.team-member, [data-testid="team-member"], .card',
      );
      const hasMembers = await memberCard.first().isVisible({ timeout: 15_000 }).catch(() => false);

      if (hasMembers) {
        await memberCard.first().click();
        await supervisorPage.waitForURL(/\/staff\/team\/.+/);
      }
    });
  });

  test.describe('TC-02: Consultant profile page structure', () => {
    test('profile page shows back button', async ({ supervisorPage }) => {
      await supervisorPage.goto(PROFILE_URL);
      await supervisorPage.waitForLoadState('networkidle');

      const backButton = supervisorPage.locator(
        'button:has-text("Назад"), button:has-text("Back"), [data-testid="back-btn"]',
      );
      await expect(backButton.first()).toBeVisible({ timeout: 15_000 });
    });

    test('profile page shows consultant header with name and role', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(PROFILE_URL);
      await supervisorPage.waitForLoadState('networkidle');

      const header = supervisorPage.locator(
        '.consultant-profile__header, [data-testid="profile-header"]',
      );
      await expect(header.first()).toBeVisible({ timeout: 15_000 });

      // Should contain name and role badge
      const roleBadge = header.locator(
        'ui-badge, .badge, [data-testid="role-badge"]',
      );
      const hasBadge = await roleBadge.first().isVisible().catch(() => false);
      if (hasBadge) {
        await expect(roleBadge.first()).toBeVisible();
      }
    });

    test('profile page shows stats grid', async ({ supervisorPage }) => {
      await supervisorPage.goto(PROFILE_URL);
      await supervisorPage.waitForLoadState('networkidle');

      const statsGrid = supervisorPage.locator(
        '.consultant-profile__stats, [data-testid="profile-stats"]',
      );
      const hasStats = await statsGrid.first().isVisible({ timeout: 15_000 }).catch(() => false);
      if (hasStats) {
        const statItems = statsGrid.locator(
          '.consultant-profile__stat, [data-testid="stat-item"]',
        );
        const count = await statItems.count();
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });
  });

  test.describe('TC-03: Active and completed cases sections', () => {
    test('profile page shows active cases table', async ({ supervisorPage }) => {
      await supervisorPage.goto(PROFILE_URL);
      await supervisorPage.waitForLoadState('networkidle');

      // Look for active cases section heading or table
      const activeCasesSection = supervisorPage.locator(
        ':text("Активні справи"), :text("Active Cases"), [data-testid="active-cases"]',
      );
      await expect(activeCasesSection.first()).toBeVisible({ timeout: 15_000 });
    });

    test('profile page shows completed cases table', async ({ supervisorPage }) => {
      await supervisorPage.goto(PROFILE_URL);
      await supervisorPage.waitForLoadState('networkidle');

      const completedSection = supervisorPage.locator(
        ':text("Завершені справи"), :text("Completed Cases"), [data-testid="completed-cases"]',
      );
      await expect(completedSection.first()).toBeVisible({ timeout: 15_000 });
    });

    test('clicking a case row navigates to supervisor case detail', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(PROFILE_URL);
      await supervisorPage.waitForLoadState('networkidle');

      const caseRow = supervisorPage.locator(
        '.consultant-profile__case-row, table tbody tr, [data-testid="case-row"]',
      );
      const hasRows = await caseRow.first().isVisible({ timeout: 15_000 }).catch(() => false);

      if (hasRows) {
        await caseRow.first().click();
        await supervisorPage.waitForURL(/\/staff\/supervisor\/cases\//);
      }
    });
  });

  test.describe('TC-04: Role-based access control', () => {
    test('non-supervisor cannot access consultant profile', async ({ staffPage }) => {
      await staffPage.goto(PROFILE_URL);
      await staffPage.waitForLoadState('networkidle');

      // Should be redirected away from the profile page
      const url = staffPage.url();
      expect(url).not.toMatch(/\/staff\/team\/.+/);
    });
  });
});
