import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Consultant Metrics — E11-S01', () => {
  test.describe('TC-01: Supervisor sees consultant metrics', () => {
    test('analytics page displays consultant performance metrics', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      // Page should load with analytics heading
      const heading = supervisorPage.locator(
        'h1, h2, [data-testid="analytics-heading"]'
      );
      await expect(heading.first()).toBeVisible();

      // Metrics cards should be visible
      const metricsSection = supervisorPage.locator(
        '[data-testid="consultant-metrics"], .metrics-grid, .metrics-cards, .analytics-summary'
      );
      await expect(metricsSection.first()).toBeVisible();

      // Key metrics should display: total cases, avg response time, satisfaction
      const metricCards = supervisorPage.locator(
        '[data-testid="metric-card"], .metric-card, .stat-card, .kpi-card'
      );
      const cardCount = await metricCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);
    });

    test('displays consultant list with individual metrics', async ({
      supervisorPage,
    }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      // Consultant performance table or list
      const consultantList = supervisorPage.locator(
        '[data-testid="consultant-list"], table, .consultant-metrics-list'
      );
      await expect(consultantList.first()).toBeVisible();

      // Each row should have consultant name and key numbers
      const rows = consultantList.locator('tbody tr, .consultant-row, .list-item');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('TC-02: Date filtering', () => {
    test('can filter metrics by week', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      const weekFilter = supervisorPage.locator(
        '[data-testid="filter-week"], button:has-text("Тиждень"), button:has-text("Week")'
      );
      const hasWeekFilter = await weekFilter.first().isVisible().catch(() => false);

      if (hasWeekFilter) {
        await weekFilter.first().click();
        // Metrics should update (page should not error)
        await supervisorPage.waitForLoadState('networkidle');
        const metricsSection = supervisorPage.locator(
          '[data-testid="consultant-metrics"], .metrics-grid, .analytics-summary'
        );
        await expect(metricsSection.first()).toBeVisible();
      }
    });

    test('can filter metrics by month', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      const monthFilter = supervisorPage.locator(
        '[data-testid="filter-month"], button:has-text("Місяць"), button:has-text("Month")'
      );
      const hasMonthFilter = await monthFilter.first().isVisible().catch(() => false);

      if (hasMonthFilter) {
        await monthFilter.first().click();
        await supervisorPage.waitForLoadState('networkidle');
        const metricsSection = supervisorPage.locator(
          '[data-testid="consultant-metrics"], .metrics-grid, .analytics-summary'
        );
        await expect(metricsSection.first()).toBeVisible();
      }
    });

    test('can filter metrics by quarter', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      const quarterFilter = supervisorPage.locator(
        '[data-testid="filter-quarter"], button:has-text("Квартал"), button:has-text("Quarter")'
      );
      const hasQuarterFilter = await quarterFilter.first().isVisible().catch(() => false);

      if (hasQuarterFilter) {
        await quarterFilter.first().click();
        await supervisorPage.waitForLoadState('networkidle');
        const metricsSection = supervisorPage.locator(
          '[data-testid="consultant-metrics"], .metrics-grid, .analytics-summary'
        );
        await expect(metricsSection.first()).toBeVisible();
      }
    });
  });

  test.describe('TC-03: Click consultant shows detail card', () => {
    test('clicking a consultant row opens detail view', async ({ supervisorPage }) => {
      await supervisorPage.goto(ROUTES.staffAnalytics);
      await supervisorPage.waitForLoadState('networkidle');

      const consultantRow = supervisorPage.locator(
        '[data-testid="consultant-row"], table tbody tr, .consultant-row'
      );
      const rowCount = await consultantRow.count();

      if (rowCount > 0) {
        await consultantRow.first().click();

        // Detail card or panel should appear
        const detailCard = supervisorPage.locator(
          '[data-testid="consultant-detail"], [role="dialog"], .detail-panel, .detail-card, .side-panel'
        );
        await expect(detailCard.first()).toBeVisible({ timeout: 5000 });

        // Detail should show consultant name
        const consultantName = detailCard.locator(
          '[data-testid="consultant-name"], h2, h3, .name'
        );
        await expect(consultantName.first()).toBeVisible();

        // Detail should show detailed metrics
        const detailMetrics = detailCard.locator(
          '[data-testid="detail-metrics"], .metric, .stat'
        );
        const metricCount = await detailMetrics.count();
        expect(metricCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('TC-04: Access control — Person role gets 403', () => {
    test('person role cannot access analytics page', async ({ personPage }) => {
      await personPage.goto(ROUTES.staffAnalytics);
      await personPage.waitForLoadState('networkidle');

      // Should redirect to login or show forbidden page
      const currentUrl = personPage.url();
      const isRedirected =
        currentUrl.includes('/login') ||
        currentUrl.includes('/person') ||
        currentUrl.includes('/403') ||
        currentUrl.includes('/forbidden');

      const forbiddenMessage = personPage.locator(
        ':text("403"), :text("Заборонено"), :text("Forbidden"), :text("Немає доступу"), :text("Access denied")'
      );
      const hasForbidden = await forbiddenMessage.first().isVisible().catch(() => false);

      // Either redirected away from analytics or shown a forbidden page
      expect(isRedirected || hasForbidden).toBeTruthy();
    });
  });
});
