import { Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the public landing page (/).
 */
export class PublicLandingPage extends BasePage {
  // ---------------------------------------------------------------------------
  // Locators
  // ---------------------------------------------------------------------------

  get heroSection(): Locator {
    return this.page.locator('[data-testid="hero-section"], .hero, section').first();
  }

  get heroHeading(): Locator {
    return this.page.locator('h1').first();
  }

  get needHelpButton(): Locator {
    return this.page.getByRole('link', { name: /допомог|need help|отримати/i });
  }

  get catalogLink(): Locator {
    return this.page.getByRole('link', { name: /каталог|catalog|курси/i });
  }

  get loginLink(): Locator {
    return this.page.getByRole('link', { name: /увійти|login|вхід/i });
  }

  get staffLoginLink(): Locator {
    return this.page.getByRole('link', { name: /staff|консультант|для спеціалістів/i });
  }

  get navigationBar(): Locator {
    return this.page.locator('nav, [data-testid="navbar"], header');
  }

  get footer(): Locator {
    return this.page.locator('footer');
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async open(): Promise<void> {
    await this.navigateTo('/');
  }

  async goToNeedHelp(): Promise<void> {
    await this.needHelpButton.click();
  }

  async goToCatalog(): Promise<void> {
    await this.catalogLink.click();
  }

  async goToLogin(): Promise<void> {
    await this.loginLink.click();
  }
}
