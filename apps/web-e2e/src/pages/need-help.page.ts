import { Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page object for the "Need Help" intake form (/need-help).
 * This is the public form where beneficiaries request support.
 */
export class NeedHelpPage extends BasePage {
  // ---------------------------------------------------------------------------
  // Locators
  // ---------------------------------------------------------------------------

  get topicSelect(): Locator {
    return this.page.getByLabel(/тема|topic|тип допомоги/i);
  }

  get descriptionTextarea(): Locator {
    return this.page.getByLabel(/опис|description|розкажіть/i);
  }

  get urgencySelect(): Locator {
    return this.page.getByLabel(/терміновість|urgency|пріоритет/i);
  }

  get countryInput(): Locator {
    return this.page.getByLabel(/країна|country/i);
  }

  get languageSelect(): Locator {
    return this.page.getByLabel(/мова|language/i);
  }

  get nameInput(): Locator {
    return this.page.getByLabel(/ім'я|name/i);
  }

  get emailInput(): Locator {
    return this.page.getByLabel(/email|електронна пошта/i);
  }

  get phoneInput(): Locator {
    return this.page.getByLabel(/телефон|phone/i);
  }

  get consentCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /згод|consent|підтверд/i });
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /надіслати|submit|відправити/i });
  }

  get successMessage(): Locator {
    return this.page.locator('[data-testid="success-message"], .success-message');
  }

  get formErrors(): Locator {
    return this.page.locator('.field-error, [data-testid="field-error"], .mat-mdc-form-field-error');
  }

  get stepIndicator(): Locator {
    return this.page.locator('[data-testid="step-indicator"], .stepper, .step-indicator');
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async open(): Promise<void> {
    await this.navigateTo('/need-help');
  }

  async fillBasicInfo(data: {
    topic?: string;
    description?: string;
    urgency?: string;
    country?: string;
    language?: string;
  }): Promise<void> {
    if (data.topic) {
      await this.topicSelect.selectOption({ label: data.topic }).catch(() =>
        this.topicSelect.fill(data.topic!),
      );
    }
    if (data.description) {
      await this.descriptionTextarea.fill(data.description);
    }
    if (data.urgency) {
      await this.urgencySelect.selectOption({ label: data.urgency }).catch(() =>
        this.urgencySelect.fill(data.urgency!),
      );
    }
    if (data.country) {
      await this.countryInput.fill(data.country);
    }
    if (data.language) {
      await this.languageSelect.selectOption({ label: data.language }).catch(() =>
        this.languageSelect.fill(data.language!),
      );
    }
  }

  async fillContactInfo(data: {
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<void> {
    if (data.name) await this.nameInput.fill(data.name);
    if (data.email) await this.emailInput.fill(data.email);
    if (data.phone) await this.phoneInput.fill(data.phone);
  }

  async acceptConsent(): Promise<void> {
    await this.consentCheckbox.check();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
