import { Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the staff dashboard (/staff).
 */
export class StaffDashboardPage extends BasePage {
  // ---------------------------------------------------------------------------
  // Locators — Sidebar navigation
  // ---------------------------------------------------------------------------

  get sidebar(): Locator {
    return this.page.locator('[data-testid="sidebar"], aside, nav.sidebar');
  }

  get sidebarCasesLink(): Locator {
    return this.page.getByRole('link', { name: /кейси|cases|запити/i });
  }

  get sidebarChatLink(): Locator {
    return this.page.getByRole('link', { name: /чат|chat|повідомлення/i });
  }

  get sidebarMeetingsLink(): Locator {
    return this.page.getByRole('link', { name: /зустрічі|meetings/i });
  }

  get sidebarCoursesLink(): Locator {
    return this.page.getByRole('link', { name: /курси|courses/i });
  }

  get sidebarAnalyticsLink(): Locator {
    return this.page.getByRole('link', { name: /аналітика|analytics/i });
  }

  get sidebarSlaLink(): Locator {
    return this.page.getByRole('link', { name: /sla/i });
  }

  // ---------------------------------------------------------------------------
  // Locators — Dashboard widgets
  // ---------------------------------------------------------------------------

  get activeCasesCount(): Locator {
    return this.page.locator('[data-testid="active-cases-count"]');
  }

  get pendingCasesCount(): Locator {
    return this.page.locator('[data-testid="pending-cases-count"]');
  }

  get upcomingMeetingsWidget(): Locator {
    return this.page.locator('[data-testid="upcoming-meetings"]');
  }

  get recentActivityList(): Locator {
    return this.page.locator('[data-testid="recent-activity"]');
  }

  get slaOverview(): Locator {
    return this.page.locator('[data-testid="sla-overview"]');
  }

  get dashboardTitle(): Locator {
    return this.page.locator('h1, [data-testid="dashboard-title"]').first();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async open(): Promise<void> {
    await this.navigateTo('/staff');
  }

  async navigateToCases(): Promise<void> {
    await this.sidebarCasesLink.click();
    await this.expectUrl('/staff/cases');
  }

  async navigateToChat(): Promise<void> {
    await this.sidebarChatLink.click();
    await this.expectUrl('/staff/chat');
  }

  async navigateToMeetings(): Promise<void> {
    await this.sidebarMeetingsLink.click();
    await this.expectUrl('/staff/meetings');
  }

  async navigateToAnalytics(): Promise<void> {
    await this.sidebarAnalyticsLink.click();
    await this.expectUrl('/staff/analytics');
  }
}
