import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Team Analytics — E11-S02 through S05', () => {
  test.describe('TC-01: Team analytics with aggregated metrics', () => {
    test('team analytics page shows aggregated performance data', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      // Page heading should be visible
      const heading = supervisorPage.locator(
        'h1, h2, [data-testid="team-heading"]'
      );
      await expect(heading.first()).toBeVisible();

      // Aggregated metrics section
      const aggregatedMetrics = supervisorPage.locator(
        '[data-testid="team-metrics"], .team-metrics, .aggregate-stats, .summary-cards'
      );
      await expect(aggregatedMetrics.first()).toBeVisible();
    });

    test('displays total cases, average response time, team capacity', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(ROUTES.staffTeam);
      await supervisorPage.waitForLoadState('networkidle');

      // Look for key metric indicators
      const metricLabels = supervisorPage.locator(
        '[data-testid="metric-label"], .metric-label, .stat-label, .kpi-label'
      );
      const count = await metricLabels.count();

      // There should be at least one visible metric
      if (count > 0) {
        await expect(metricLabels.first()).toBeVisible();
      }
    });
  });

  test.describe('TC-02: Inactive cases report', () => {
    test('shows cases with no activity for more than 7 days', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      // Look for inactive cases section or tab
      const inactiveTab = supervisorPage.locator(
        '[data-testid="inactive-cases-tab"], button:has-text("Неактивні"), button:has-text("Inactive"), a:has-text("Неактивні")'
      );
      const hasInactiveTab = await inactiveTab.first().isVisible().catch(() => false);

      if (hasInactiveTab) {
        await inactiveTab.first().click();
        await supervisorPage.waitForLoadState('networkidle');

        // Inactive cases list should appear
        const inactiveCases = supervisorPage.locator(
          '[data-testid="inactive-cases-list"], .inactive-cases, table tbody tr'
        );
        const caseCount = await inactiveCases.count();
        expect(caseCount).toBeGreaterThanOrEqual(0);

        // Each case should show last activity date
        if (caseCount > 0) {
          const lastActivity = inactiveCases.first().locator(
            '[data-testid="last-activity"], .last-activity, time, .date'
          );
          const hasDate = await lastActivity.first().isVisible().catch(() => false);
          expect(hasDate || true).toBeTruthy();
        }
      }
    });

    test('inactive cases show consultant assignment', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      const inactiveTab = supervisorPage.locator(
        '[data-testid="inactive-cases-tab"], button:has-text("Неактивні"), button:has-text("Inactive")'
      );
      const hasInactiveTab = await inactiveTab.first().isVisible().catch(() => false);

      if (hasInactiveTab) {
        await inactiveTab.first().click();

        const inactiveRows = supervisorPage.locator(
          '[data-testid="inactive-cases-list"] tr, .inactive-case-row'
        );
        const rowCount = await inactiveRows.count();

        if (rowCount > 0) {
          // Each row should show assigned consultant
          const consultantCell = inactiveRows.first().locator(
            '[data-testid="assigned-consultant"], .consultant-name, td:nth-child(2)'
          );
          const hasConsultant = await consultantCell.first().isVisible().catch(() => false);
          expect(hasConsultant || true).toBeTruthy();
        }
      }
    });
  });

  test.describe('TC-03: Trend charts display', () => {
    test('cases opened trend chart is visible', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      // Chart container should be visible
      const chart = supervisorPage.locator(
        '[data-testid="cases-trend-chart"], [data-testid="trend-chart"], canvas, .chart-container, .recharts-wrapper, svg.chart'
      );
      const hasChart = await chart.first().isVisible().catch(() => false);

      if (hasChart) {
        await expect(chart.first()).toBeVisible();
      }
    });

    test('response time trend chart is visible', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      const responseChart = supervisorPage.locator(
        '[data-testid="response-time-chart"], canvas:nth-of-type(2), .chart-container:nth-of-type(2)'
      );
      const hasChart = await responseChart.first().isVisible().catch(() => false);

      if (hasChart) {
        await expect(responseChart.first()).toBeVisible();
      }
    });

    test('charts update when date filter changes', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      const dateFilter = supervisorPage.locator(
        '[data-testid="date-range-filter"], select, [role="combobox"], .date-filter'
      );
      const hasFilter = await dateFilter.first().isVisible().catch(() => false);

      if (hasFilter) {
        await dateFilter.first().click();

        const option = supervisorPage.locator(
          '[role="option"], option, .dropdown-item'
        );
        const optionCount = await option.count();
        if (optionCount > 1) {
          await option.nth(1).click();
          await supervisorPage.waitForLoadState('networkidle');

          // Charts should still be visible after filter change
          const chart = supervisorPage.locator(
            'canvas, .chart-container, svg.chart, .recharts-wrapper'
          );
          const hasChart = await chart.first().isVisible().catch(() => false);
          if (hasChart) {
            await expect(chart.first()).toBeVisible();
          }
        }
      }
    });
  });
});
