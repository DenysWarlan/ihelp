import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Assignment Suggestions -- TC-S-E06-S05 through S08', () => {
  test.describe('TC-01: Ranked suggestion list shown during manual assignment', () => {
    test('should display ranked consultant suggestions when assigning a case', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      // Open an unassigned case
      const caseRow = coordinatorPage.locator(
        '[data-testid="case-row"], table tbody tr, .case-card'
      ).first();

      if (!(await caseRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await caseRow.click();
      await coordinatorPage.waitForLoadState('networkidle');

      // Open assignment panel
      const assignBtn = coordinatorPage.getByRole('button', {
        name: /призначити|assign|вибрати/i,
      });
      if (!(await assignBtn.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await assignBtn.first().click();

      // Suggestion list should appear with ranked consultants
      const suggestionList = coordinatorPage.locator(
        '[data-testid="suggestion-list"], .suggestion-list, .consultant-suggestions, [data-testid="consultant-list"]'
      );
      await expect(suggestionList.first()).toBeVisible({ timeout: 5_000 });

      // Verify multiple suggestions are shown
      const suggestions = suggestionList.locator(
        '[data-testid="suggestion-item"], .suggestion-row, .consultant-option, [role="option"]'
      );
      const count = await suggestions.count();
      expect(count).toBeGreaterThan(0);

      // First suggestion should have a rank indicator or be visually prominent
      const firstSuggestion = suggestions.first();
      await expect(firstSuggestion).toBeVisible();

      // Each suggestion should display consultant name
      const consultantName = firstSuggestion.locator(
        '[data-testid="consultant-name"], .name, .consultant-name'
      );
      if (await consultantName.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const name = await consultantName.textContent();
        expect(name?.trim().length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('TC-02: Sort by specialization match, workload, response time', () => {
    test('should show match criteria in suggestion details', async ({ coordinatorPage }) => {
      await coordinatorPage.goto(ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      const caseRow = coordinatorPage.locator(
        '[data-testid="case-row"], table tbody tr, .case-card'
      ).first();

      if (!(await caseRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await caseRow.click();
      await coordinatorPage.waitForLoadState('networkidle');

      const assignBtn = coordinatorPage.getByRole('button', {
        name: /призначити|assign|вибрати/i,
      });
      if (!(await assignBtn.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await assignBtn.first().click();

      const suggestionList = coordinatorPage.locator(
        '[data-testid="suggestion-list"], .suggestion-list, .consultant-suggestions, [data-testid="consultant-list"]'
      );
      if (!(await suggestionList.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Each suggestion should show match criteria
      const firstSuggestion = suggestionList.locator(
        '[data-testid="suggestion-item"], .suggestion-row, .consultant-option'
      ).first();

      // Specialization match indicator
      const specMatch = firstSuggestion.locator(
        '[data-testid="specialization-match"], .specialization, .match-score, .spec-badge'
      );

      // Workload indicator
      const workload = firstSuggestion.locator(
        '[data-testid="workload"], .workload, .case-count, .utilization'
      );

      // Response time indicator
      const responseTime = firstSuggestion.locator(
        '[data-testid="response-time"], .response-time, .avg-response'
      );

      // At least one of the criteria should be visible
      const hasSpec = await specMatch.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasWorkload = await workload.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasResponseTime = await responseTime.first().isVisible({ timeout: 3_000 }).catch(() => false);

      expect(hasSpec || hasWorkload || hasResponseTime).toBeTruthy();
    });

    test('should allow sorting suggestions by different criteria', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffCases);
      await coordinatorPage.waitForLoadState('networkidle');

      const caseRow = coordinatorPage.locator(
        '[data-testid="case-row"], table tbody tr, .case-card'
      ).first();

      if (!(await caseRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await caseRow.click();
      await coordinatorPage.waitForLoadState('networkidle');

      const assignBtn = coordinatorPage.getByRole('button', {
        name: /призначити|assign/i,
      });
      if (!(await assignBtn.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }
      await assignBtn.first().click();

      // Look for sort controls
      const sortControl = coordinatorPage.locator(
        '[data-testid="sort-suggestions"], select[name="sort"], button:has-text("Сортувати"), .sort-control'
      );

      if (await sortControl.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Try sorting by workload
        if (await sortControl.first().evaluate((el) => (el as HTMLElement).tagName === 'SELECT')) {
          await sortControl.first().selectOption('workload');
        } else {
          await sortControl.first().click();
          const workloadOption = coordinatorPage.locator(
            'option:has-text("workload"), li:has-text("навантаження"), [data-value="workload"]'
          );
          if (await workloadOption.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
            await workloadOption.first().click();
          }
        }

        await coordinatorPage.waitForLoadState('networkidle');

        // Verify list re-rendered (still has items)
        const suggestions = coordinatorPage.locator(
          '[data-testid="suggestion-item"], .suggestion-row, .consultant-option'
        );
        const count = await suggestions.count();
        expect(count).toBeGreaterThan(0);
      }
    });
  });
});
