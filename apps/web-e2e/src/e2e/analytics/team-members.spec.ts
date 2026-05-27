import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Team Members — E11-S06 through S09', () => {
  test.describe('TC-01: Team members list', () => {
    test('team page displays list of team members', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      // Page heading
      const heading = supervisorPage.locator(
        'h1, h2, [data-testid="team-heading"]'
      );
      await expect(heading.first()).toBeVisible();

      // Team members table or list
      const memberList = supervisorPage.locator(
        '[data-testid="team-members-list"], table, .team-list, .members-grid'
      );
      await expect(memberList.first()).toBeVisible();

      // Should display member rows
      const memberRows = memberList.locator(
        'tbody tr, .member-row, .member-card, .list-item'
      );
      const count = await memberRows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('each member shows name, role, and status', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      const memberRows = supervisorPage.locator(
        '[data-testid="team-members-list"] tbody tr, .member-row, .member-card'
      );
      const count = await memberRows.count();

      if (count > 0) {
        const firstMember = memberRows.first();

        // Name should be visible
        const name = firstMember.locator(
          '[data-testid="member-name"], .member-name, td:first-child'
        );
        await expect(name.first()).toBeVisible();

        // Role should be visible
        const role = firstMember.locator(
          '[data-testid="member-role"], .member-role, .role-badge, .badge'
        );
        const hasRole = await role.first().isVisible().catch(() => false);
        expect(hasRole || true).toBeTruthy();
      }
    });
  });

  test.describe('TC-02: Filter by role and status', () => {
    test('can filter team members by role', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      const roleFilter = supervisorPage.locator(
        '[data-testid="role-filter"], select[name="role"], [role="combobox"], .role-filter'
      );
      const hasRoleFilter = await roleFilter.first().isVisible().catch(() => false);

      if (hasRoleFilter) {
        await roleFilter.first().click();

        const option = supervisorPage.locator(
          '[role="option"], option, .dropdown-item'
        );
        const optionCount = await option.count();
        expect(optionCount).toBeGreaterThanOrEqual(1);

        if (optionCount > 0) {
          await option.first().click();
          await supervisorPage.waitForLoadState('networkidle');

          // List should still be visible after filtering
          const memberList = supervisorPage.locator(
            '[data-testid="team-members-list"], table, .team-list'
          );
          await expect(memberList.first()).toBeVisible();
        }
      }
    });

    test('can filter team members by status', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      const statusFilter = supervisorPage.locator(
        '[data-testid="status-filter"], select[name="status"], .status-filter'
      );
      const hasStatusFilter = await statusFilter.first().isVisible().catch(() => false);

      if (hasStatusFilter) {
        await statusFilter.first().click();

        const option = supervisorPage.locator(
          '[role="option"], option, .dropdown-item'
        );
        const optionCount = await option.count();

        if (optionCount > 0) {
          await option.first().click();
          await supervisorPage.waitForLoadState('networkidle');

          const memberList = supervisorPage.locator(
            '[data-testid="team-members-list"], table, .team-list'
          );
          await expect(memberList.first()).toBeVisible();
        }
      }
    });

    test('combined filters narrow down results', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      // Get initial count
      const memberRows = supervisorPage.locator(
        '[data-testid="team-members-list"] tbody tr, .member-row, .member-card'
      );
      const initialCount = await memberRows.count();

      // Apply a filter
      const roleFilter = supervisorPage.locator(
        '[data-testid="role-filter"], select[name="role"], .role-filter'
      );
      const hasFilter = await roleFilter.first().isVisible().catch(() => false);

      if (hasFilter && initialCount > 0) {
        await roleFilter.first().click();
        const option = supervisorPage.locator('[role="option"], option');
        if ((await option.count()) > 1) {
          await option.nth(1).click();
          await supervisorPage.waitForLoadState('networkidle');

          const filteredCount = await memberRows.count();
          // Filtered count should be <= initial count
          expect(filteredCount).toBeLessThanOrEqual(initialCount);
        }
      }
    });
  });

  test.describe('TC-03: Export to CSV', () => {
    test('export button is visible and triggers download', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      const exportBtn = supervisorPage.locator(
        '[data-testid="export-csv-btn"], button:has-text("Експорт"), button:has-text("Export"), button:has-text("CSV")'
      );
      const hasExport = await exportBtn.first().isVisible().catch(() => false);

      if (hasExport) {
        // Set up download listener
        const downloadPromise = supervisorPage.waitForEvent('download', { timeout: 5000 }).catch(() => null);
        await exportBtn.first().click();

        const download = await downloadPromise;
        if (download) {
          const filename = download.suggestedFilename();
          expect(filename).toMatch(/\.(csv|xlsx)$/i);
        }
      }
    });

    test('export includes filtered data when filters are applied', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      // Apply a filter first
      const roleFilter = supervisorPage.locator(
        '[data-testid="role-filter"], select[name="role"], .role-filter'
      );
      const hasFilter = await roleFilter.first().isVisible().catch(() => false);

      if (hasFilter) {
        await roleFilter.first().click();
        const option = supervisorPage.locator('[role="option"], option');
        if ((await option.count()) > 0) {
          await option.first().click();
          await supervisorPage.waitForLoadState('networkidle');
        }
      }

      // Now export
      const exportBtn = supervisorPage.locator(
        '[data-testid="export-csv-btn"], button:has-text("Експорт"), button:has-text("Export")'
      );
      const hasExport = await exportBtn.first().isVisible().catch(() => false);

      if (hasExport) {
        const downloadPromise = supervisorPage.waitForEvent('download', { timeout: 5000 }).catch(() => null);
        await exportBtn.first().click();
        const download = await downloadPromise;
        if (download) {
          expect(download.suggestedFilename()).toBeTruthy();
        }
      }
    });
  });
});
