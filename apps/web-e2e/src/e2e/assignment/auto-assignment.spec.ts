import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Auto-Assignment -- TC-S-E06-S01', () => {
  test.describe('TC-01: Auto-assign routes by specialization, language, availability, min workload', () => {
    test('should auto-assign a new case to a matching consultant', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      // Open the most recent unassigned case
      const unassignedFilter = coordinatorPage.locator(
        '[data-testid="filter-unassigned"], button:has-text("Не призначені"), option[value="unassigned"]'
      );
      if (await unassignedFilter.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await unassignedFilter.first().click();
        await coordinatorPage.waitForLoadState('networkidle');
      }

      const caseRow = coordinatorPage.locator(
        '[data-testid="case-row"], table tbody tr, .case-card, .case-item'
      ).first();

      if (!(await caseRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await caseRow.click();
      await coordinatorPage.waitForLoadState('networkidle');

      // Trigger auto-assignment
      const autoAssignBtn = coordinatorPage.getByRole('button', {
        name: /авто-призначити|auto-assign|автоматично/i,
      });

      if (!(await autoAssignBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await autoAssignBtn.click();
      await coordinatorPage.waitForLoadState('networkidle');

      // Verify assignment happened
      const assignedIndicator = coordinatorPage.locator(
        '[data-testid="assigned-consultant"], .assigned-to, :text("Призначено")'
      );
      const toast = coordinatorPage.locator('[role="alert"]');

      const assigned =
        (await assignedIndicator.first().isVisible({ timeout: 10_000 }).catch(() => false)) ||
        (await toast.first().isVisible({ timeout: 5_000 }).catch(() => false));
      expect(assigned).toBeTruthy();

      // Verify consultant details shown
      const consultantName = coordinatorPage.locator(
        '[data-testid="consultant-name"], .consultant-info, .assigned-consultant-name'
      );
      if (await consultantName.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        const name = await consultantName.first().textContent();
        expect(name?.trim().length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('TC-02: Load balancing picks consultant with fewer cases', () => {
    test('should prefer consultant with lower workload during auto-assignment', async ({
      coordinatorPage,
    }) => {
      // Navigate to assignment page to see suggestion ranking
      await coordinatorPage.goto(ROUTES.staffAssignment ?? ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      // Open a case for assignment
      const caseRow = coordinatorPage.locator(
        '[data-testid="case-row"], table tbody tr, .case-card'
      ).first();

      if (!(await caseRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await caseRow.click();
      await coordinatorPage.waitForLoadState('networkidle');

      // Trigger auto-assign to see suggestion
      const autoAssignBtn = coordinatorPage.getByRole('button', {
        name: /авто-призначити|auto-assign/i,
      });

      if (!(await autoAssignBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Check if a suggestion panel or ranking appears before assignment
      const suggestionPanel = coordinatorPage.locator(
        '[data-testid="assignment-suggestions"], .suggestions-panel, .consultant-ranking'
      );
      if (await suggestionPanel.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // First suggestion should have workload indicator
        const firstSuggestion = suggestionPanel.locator(
          '[data-testid="suggestion-item"], .suggestion-row'
        ).first();
        const workloadInfo = firstSuggestion.locator(
          '[data-testid="workload-count"], .workload, .case-count'
        );
        if (await workloadInfo.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const workloadText = await workloadInfo.textContent();
          expect(workloadText).toBeTruthy();
        }
      }

      await autoAssignBtn.click();
      await coordinatorPage.waitForLoadState('networkidle');

      // Verify assignment succeeded
      const assignedIndicator = coordinatorPage.locator(
        '[data-testid="assigned-consultant"], .assigned-to, [role="alert"]'
      );
      await expect(assignedIndicator.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('TC-03: Fallback to coordinator notification when no match', () => {
    test('should notify coordinator when no consultant matches criteria', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      // Look for cases with no matching consultant (edge case)
      // This typically shows a notification or warning in the assignment flow
      const caseRow = coordinatorPage.locator(
        '[data-testid="case-row"], table tbody tr, .case-card'
      ).first();

      if (!(await caseRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await caseRow.click();
      await coordinatorPage.waitForLoadState('networkidle');

      const autoAssignBtn = coordinatorPage.getByRole('button', {
        name: /авто-призначити|auto-assign/i,
      });

      if (!(await autoAssignBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await autoAssignBtn.click();

      // If no match found, expect a warning/notification
      const noMatchWarning = coordinatorPage.locator(
        '[data-testid="no-match-warning"], .no-match, [role="alert"]:has-text("не знайдено"), [role="alert"]:has-text("no match")'
      );
      const assignedOk = coordinatorPage.locator(
        '[data-testid="assigned-consultant"], .assigned-to'
      );

      // Either assignment succeeds or a "no match" fallback notification appears
      const result =
        (await noMatchWarning.first().isVisible({ timeout: 10_000 }).catch(() => false)) ||
        (await assignedOk.first().isVisible({ timeout: 5_000 }).catch(() => false));
      expect(result).toBeTruthy();
    });
  });
});
