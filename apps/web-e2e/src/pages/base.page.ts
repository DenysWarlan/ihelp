import { Page, Locator, expect } from '@playwright/test';

/**
 * Base page object providing common helpers shared by all page objects.
 * Every concrete page object should extend this class.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async expectUrl(path: string): Promise<void> {
    await this.page.waitForURL(`**${path}**`);
  }

  // ---------------------------------------------------------------------------
  // Common locators
  // ---------------------------------------------------------------------------

  get toastMessage(): Locator {
    return this.page.locator('.toast-message, [role="alert"], .notification');
  }

  get loadingSpinner(): Locator {
    return this.page.locator('.loading-spinner, [data-testid="loading"], .spinner');
  }

  get pageHeading(): Locator {
    return this.page.locator('h1').first();
  }

  // ---------------------------------------------------------------------------
  // Interaction helpers
  // ---------------------------------------------------------------------------

  async waitForToast(text: string): Promise<void> {
    await this.toastMessage.filter({ hasText: text }).waitFor({ timeout: 10_000 });
  }

  async waitForLoadingToDisappear(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15_000 });
  }

  async fillInput(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).fill(value);
  }

  async fillByLabel(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  async fillByPlaceholder(placeholder: string, value: string): Promise<void> {
    await this.page.getByPlaceholder(placeholder).fill(value);
  }

  async clickButton(text: string): Promise<void> {
    await this.page.getByRole('button', { name: text }).click();
  }

  async clickLink(text: string): Promise<void> {
    await this.page.getByRole('link', { name: text }).click();
  }

  // ---------------------------------------------------------------------------
  // Assertions
  // ---------------------------------------------------------------------------

  async expectHeading(text: string): Promise<void> {
    await expect(this.pageHeading).toContainText(text);
  }

  async expectVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }

  async expectHidden(locator: Locator): Promise<void> {
    await expect(locator).toBeHidden();
  }
}
