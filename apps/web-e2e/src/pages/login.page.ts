import { Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the staff login page (/staff/login).
 * Covers the email + password + optional MFA flow.
 */
export class LoginPage extends BasePage {
  // ---------------------------------------------------------------------------
  // Locators
  // ---------------------------------------------------------------------------

  get emailInput(): Locator {
    return this.page.getByLabel(/email|електронна пошта/i);
  }

  get passwordInput(): Locator {
    return this.page.getByLabel(/password|пароль/i);
  }

  get mfaCodeInput(): Locator {
    return this.page.getByLabel(/code|код|mfa|otp/i);
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /увійти|login|sign in|далі/i });
  }

  get mfaSubmitButton(): Locator {
    return this.page.getByRole('button', { name: /підтвердити|verify|confirm/i });
  }

  get errorMessage(): Locator {
    return this.page.locator('[data-testid="login-error"], .error-message, [role="alert"]');
  }

  get forgotPasswordLink(): Locator {
    return this.page.getByRole('link', { name: /забули|forgot|відновити/i });
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async open(): Promise<void> {
    await this.navigateTo('/staff/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async enterMfaCode(code: string): Promise<void> {
    await this.mfaCodeInput.fill(code);
    await this.mfaSubmitButton.click();
  }

  async loginWithMfa(email: string, password: string, mfaCode: string): Promise<void> {
    await this.login(email, password);
    await this.mfaCodeInput.waitFor({ state: 'visible', timeout: 5_000 });
    await this.enterMfaCode(mfaCode);
  }
}
