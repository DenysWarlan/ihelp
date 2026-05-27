import { Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the cases list (/staff/cases) and case detail (/staff/cases/:id).
 */
export class CasesPage extends BasePage {
  // ---------------------------------------------------------------------------
  // Locators — Cases list
  // ---------------------------------------------------------------------------

  get casesTable(): Locator {
    return this.page.locator('[data-testid="cases-table"], table, .cases-list');
  }

  get caseRows(): Locator {
    return this.page.locator('[data-testid="case-row"], tbody tr, .case-item');
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder(/пошук|search|знайти/i);
  }

  get statusFilter(): Locator {
    return this.page.getByLabel(/статус|status|фільтр/i);
  }

  get urgencyFilter(): Locator {
    return this.page.getByLabel(/терміновість|urgency|пріоритет/i);
  }

  get createCaseButton(): Locator {
    return this.page.getByRole('button', { name: /створити|create|новий/i });
  }

  get paginationControls(): Locator {
    return this.page.locator('[data-testid="pagination"], .pagination, nav[aria-label="pagination"]');
  }

  get emptyState(): Locator {
    return this.page.locator('[data-testid="empty-state"], .empty-state');
  }

  // ---------------------------------------------------------------------------
  // Locators — Case detail
  // ---------------------------------------------------------------------------

  get caseTitle(): Locator {
    return this.page.locator('[data-testid="case-title"], h1, h2').first();
  }

  get caseStatus(): Locator {
    return this.page.locator('[data-testid="case-status"], .case-status, .badge');
  }

  get caseTimeline(): Locator {
    return this.page.locator('[data-testid="case-timeline"], .timeline');
  }

  get assigneeInfo(): Locator {
    return this.page.locator('[data-testid="assignee"], .assignee');
  }

  get addNoteButton(): Locator {
    return this.page.getByRole('button', { name: /нотатка|note|додати/i });
  }

  get noteInput(): Locator {
    return this.page.getByLabel(/нотатка|note|коментар/i);
  }

  get transferButton(): Locator {
    return this.page.getByRole('button', { name: /передати|transfer|переназначити/i });
  }

  get closeCaseButton(): Locator {
    return this.page.getByRole('button', { name: /закрити|close|завершити/i });
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async open(): Promise<void> {
    await this.navigateTo('/staff/cases');
  }

  async openCase(index: number): Promise<void> {
    await this.caseRows.nth(index).click();
  }

  async openCaseById(id: string): Promise<void> {
    await this.navigateTo(`/staff/cases/${id}`);
  }

  async searchCases(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption({ label: status }).catch(() =>
      this.statusFilter.fill(status),
    );
  }

  async getCaseCount(): Promise<number> {
    return this.caseRows.count();
  }

  async addNote(text: string): Promise<void> {
    await this.addNoteButton.click();
    await this.noteInput.fill(text);
    await this.clickButton('Зберегти');
  }
}
