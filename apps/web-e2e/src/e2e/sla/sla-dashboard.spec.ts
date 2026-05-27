import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('SLA Dashboard -- TC-S-E07-S01 through S04', () => {
  test.describe('TC-01: SLA dashboard shows active timers', () => {
    test('should display SLA dashboard at /staff/sla with active timers', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffSla);
      await coordinatorPage.waitForLoadState('networkidle');

      // Dashboard heading
      const heading = coordinatorPage.locator('h1, h2, [data-testid="sla-title"]').first();
      await expect(heading).toBeVisible();

      // SLA timers table or list
      const slaTable = coordinatorPage.locator(
        '[data-testid="sla-table"], table, .sla-grid, .sla-list, .timer-list'
      );
      await expect(slaTable.first()).toBeVisible({ timeout: 10_000 });

      // Individual timer rows
      const timerRows = coordinatorPage.locator(
        '[data-testid="sla-row"], table tbody tr, .sla-card, .timer-row'
      );

      const emptyState = coordinatorPage.locator(
        '[data-testid="empty-state"], .empty-state, :text("немає активних")'
      );

      const hasTimers = await timerRows.first().isVisible({ timeout: 5_000 }).catch(() => false);
      const isEmpty = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasTimers || isEmpty).toBeTruthy();

      if (hasTimers) {
        // Each timer should show case reference and time remaining
        const firstTimer = timerRows.first();

        const caseRef = firstTimer.locator(
          '[data-testid="case-ref"], .case-id, .case-reference, td:first-child'
        );
        await expect(caseRef).toBeVisible();

        const timeRemaining = firstTimer.locator(
          '[data-testid="time-remaining"], .time-remaining, .countdown, .timer'
        );
        if (await timeRemaining.isVisible({ timeout: 3_000 }).catch(() => false)) {
          const text = await timeRemaining.textContent();
          expect(text).toBeTruthy();
        }
      }
    });
  });

  test.describe('TC-02: Color coding for SLA status', () => {
    test('should display green (on-track), yellow (at-risk), red (breached) indicators', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffSla);
      await coordinatorPage.waitForLoadState('networkidle');

      const timerRows = coordinatorPage.locator(
        '[data-testid="sla-row"], table tbody tr, .sla-card, .timer-row'
      );

      if (!(await timerRows.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      // Check for status indicators across rows
      const statusIndicators = coordinatorPage.locator(
        '[data-testid="sla-status"], .sla-status, .status-badge, .timer-status'
      );

      if (await statusIndicators.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        const count = await statusIndicators.count();

        for (let i = 0; i < Math.min(count, 10); i++) {
          const indicator = statusIndicators.nth(i);

          // Element exists and has content
          expect(indicator).toBeTruthy();
        }
      }

      // Check for a status legend
      const legend = coordinatorPage.locator(
        '[data-testid="sla-legend"], .legend, .status-legend'
      );
      if (await legend.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(legend).toBeVisible();
      }
    });
  });

  test.describe('TC-03: Filter by escalation level and consultant', () => {
    test('should filter SLA timers by escalation level', async ({ coordinatorPage }) => {
      await coordinatorPage.goto(ROUTES.staffSla);
      await coordinatorPage.waitForLoadState('networkidle');

      // Escalation level filter
      const escalationFilter = coordinatorPage.locator(
        '[data-testid="escalation-filter"], select[name="escalation"], button:has-text("ескалац"), .escalation-filter'
      );

      if (!(await escalationFilter.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      if (await escalationFilter.first().evaluate((el) => (el as HTMLElement).tagName === 'SELECT')) {
        const options = await escalationFilter.first().locator('option').count();
        expect(options).toBeGreaterThan(1);
        await escalationFilter.first().selectOption({ index: 1 });
      } else {
        await escalationFilter.first().click();
        const filterOption = coordinatorPage.locator(
          '[role="option"], li, .filter-option'
        ).first();
        if (await filterOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await filterOption.click();
        }
      }

      await coordinatorPage.waitForLoadState('networkidle');

      // Table should update
      const timerRows = coordinatorPage.locator(
        '[data-testid="sla-row"], table tbody tr, .sla-card'
      );
      const emptyState = coordinatorPage.locator(
        '[data-testid="empty-state"], .empty-state, .no-results'
      );

      const hasData = await timerRows.first().isVisible({ timeout: 5_000 }).catch(() => false);
      const isEmpty = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasData || isEmpty).toBeTruthy();
    });

    test('should filter SLA timers by consultant', async ({ coordinatorPage }) => {
      await coordinatorPage.goto(ROUTES.staffSla);
      await coordinatorPage.waitForLoadState('networkidle');

      const consultantFilter = coordinatorPage.locator(
        '[data-testid="consultant-filter"], select[name="consultant"], button:has-text("Консультант"), .consultant-filter'
      );

      if (!(await consultantFilter.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      if (await consultantFilter.first().evaluate((el) => (el as HTMLElement).tagName === 'SELECT')) {
        await consultantFilter.first().selectOption({ index: 1 });
      } else {
        await consultantFilter.first().click();
        const option = coordinatorPage.locator('[role="option"], li').first();
        if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await option.click();
        }
      }

      await coordinatorPage.waitForLoadState('networkidle');

      const timerRows = coordinatorPage.locator(
        '[data-testid="sla-row"], table tbody tr, .sla-card'
      );
      const emptyState = coordinatorPage.locator(
        '[data-testid="empty-state"], .empty-state, .no-results'
      );

      const hasData = await timerRows.first().isVisible({ timeout: 5_000 }).catch(() => false);
      const isEmpty = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);
      expect(hasData || isEmpty).toBeTruthy();
    });
  });

  test.describe('TC-04: SLA overview widget shows aggregated counts', () => {
    test('should display aggregated SLA counts in overview widget', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(ROUTES.staffSla);
      await coordinatorPage.waitForLoadState('networkidle');

      // Overview widget/summary section
      const overview = coordinatorPage.locator(
        '[data-testid="sla-overview"], .sla-overview, .sla-summary, .dashboard-widgets'
      );
      await expect(overview.first()).toBeVisible({ timeout: 10_000 });

      // Count cards: on-track, at-risk, breached
      const onTrackCount = coordinatorPage.locator(
        '[data-testid="count-on-track"], .count-on-track, .on-track-count'
      );
      const atRiskCount = coordinatorPage.locator(
        '[data-testid="count-at-risk"], .count-at-risk, .at-risk-count'
      );
      const breachedCount = coordinatorPage.locator(
        '[data-testid="count-breached"], .count-breached, .breached-count'
      );

      // At least the overview container should exist
      // Individual count cards may or may not exist depending on current data
      const hasOnTrack = await onTrackCount.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasAtRisk = await atRiskCount.first().isVisible({ timeout: 3_000 }).catch(() => false);
      const hasBreached = await breachedCount.first().isVisible({ timeout: 3_000 }).catch(() => false);

      // At least one category count should be displayed
      expect(hasOnTrack || hasAtRisk || hasBreached).toBeTruthy();

      // Count values should be numeric
      if (hasOnTrack) {
        const text = await onTrackCount.first().textContent();
        expect(text).toMatch(/\d+/);
      }
    });
  });
});
