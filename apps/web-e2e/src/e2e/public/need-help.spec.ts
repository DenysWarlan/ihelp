import { test, expect } from '@playwright/test';

test.describe('Форма "Потрібна допомога" — E14-S04 / E02-S01', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/need-help');
  });

  test('TC-01: форма відображається з усіма полями', async ({ page }) => {
    await expect(page).toHaveURL(/\/need-help/);

    // Name field
    const nameField = page.locator(
      '[data-testid="field-name"], input[name="name"], input[placeholder*="ім\'я" i], input[placeholder*="name" i]'
    );
    await expect(nameField.first()).toBeVisible();

    // Country field
    const countryField = page.locator(
      '[data-testid="field-country"], select[name="country"], input[name="country"], [data-testid="country-select"]'
    );
    await expect(countryField.first()).toBeVisible();

    // Language field
    const languageField = page.locator(
      '[data-testid="field-language"], select[name="language"], input[name="language"], [data-testid="language-select"]'
    );
    await expect(languageField.first()).toBeVisible();

    // Topic field
    const topicField = page.locator(
      '[data-testid="field-topic"], textarea[name="topic"], input[name="topic"], [data-testid="topic-input"]'
    );
    await expect(topicField.first()).toBeVisible();

    // Urgency field
    const urgencyField = page.locator(
      '[data-testid="field-urgency"], select[name="urgency"], [data-testid="urgency-select"], input[name="urgency"]'
    );
    await expect(urgencyField.first()).toBeVisible();
  });

  test('TC-02: GDPR-чекбокси відображаються (загальна згода та Ст.9)', async ({
    page,
  }) => {
    // General GDPR consent checkbox
    const generalConsent = page.locator(
      '[data-testid="consent-general"], input[name*="consent"], input[type="checkbox"]'
    );
    await expect(generalConsent.first()).toBeVisible();

    // Art.9 sensitive data consent checkbox
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThanOrEqual(2);
  });

  test('TC-03: валідація — обов\'язкові поля не заповнені', async ({ page }) => {
    // Try to submit without filling anything
    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="submit-button"]'
    );
    await submitBtn.first().click();

    // Validation errors should appear
    const errorMessages = page.locator(
      '.error, .field-error, [data-testid*="error"], .invalid-feedback, [role="alert"]'
    );
    await expect(errorMessages.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-04: валідація — згода GDPR обов\'язкова', async ({ page }) => {
    // Fill all fields but don't check consent
    const nameField = page.locator(
      '[data-testid="field-name"], input[name="name"], input[placeholder*="ім\'я" i], input[placeholder*="name" i]'
    );
    await nameField.first().fill('Test User');

    const topicField = page.locator(
      '[data-testid="field-topic"], textarea[name="topic"], input[name="topic"]'
    );
    await topicField.first().fill('Test topic description for help request');

    // Submit without checking consent boxes
    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="submit-button"]'
    );
    await submitBtn.first().click();

    // Should show consent-related error or prevent submission
    const consentError = page.locator(
      '[data-testid*="consent-error"], .error, [role="alert"]'
    );
    await expect(consentError.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-05: успішне надсилання форми показує підтвердження', async ({
    page,
  }) => {
    // Fill name
    const nameField = page.locator(
      '[data-testid="field-name"], input[name="name"], input[placeholder*="ім\'я" i], input[placeholder*="name" i]'
    );
    await nameField.first().fill('Test User');

    // Fill country (try select or input)
    const countrySelect = page.locator(
      'select[name="country"], [data-testid="country-select"]'
    );
    const countryInput = page.locator('input[name="country"]');
    if (await countrySelect.first().isVisible().catch(() => false)) {
      await countrySelect.first().selectOption({ index: 1 });
    } else if (await countryInput.first().isVisible().catch(() => false)) {
      await countryInput.first().fill('Ukraine');
    }

    // Fill language (try select or input)
    const languageSelect = page.locator(
      'select[name="language"], [data-testid="language-select"]'
    );
    const languageInput = page.locator('input[name="language"]');
    if (await languageSelect.first().isVisible().catch(() => false)) {
      await languageSelect.first().selectOption({ index: 1 });
    } else if (await languageInput.first().isVisible().catch(() => false)) {
      await languageInput.first().fill('Ukrainian');
    }

    // Fill topic
    const topicField = page.locator(
      '[data-testid="field-topic"], textarea[name="topic"], input[name="topic"]'
    );
    await topicField.first().fill('I need help with legal consultation regarding housing');

    // Select urgency
    const urgencySelect = page.locator(
      'select[name="urgency"], [data-testid="urgency-select"]'
    );
    const urgencyInput = page.locator('input[name="urgency"]');
    if (await urgencySelect.first().isVisible().catch(() => false)) {
      await urgencySelect.first().selectOption({ index: 1 });
    } else if (await urgencyInput.first().isVisible().catch(() => false)) {
      await urgencyInput.first().fill('medium');
    }

    // Check both GDPR consent checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    // Submit
    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="submit-button"]'
    );
    await submitBtn.first().click();

    // Confirmation message or redirect
    const confirmation = page.locator(
      '[data-testid="confirmation"], .confirmation, .success, :text("дякуємо"), :text("подяк"), :text("отриман"), :text("thank")'
    );
    await expect(confirmation.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-06: форма доступна без автентифікації', async ({ page }) => {
    // Clear any auth tokens
    await page.evaluate(() => localStorage.removeItem('ihelp_token'));
    await page.goto('/need-help');

    // Form should still be visible (public page)
    await expect(page).toHaveURL(/\/need-help/);

    const formElement = page.locator(
      'form, [data-testid="need-help-form"]'
    );
    await expect(formElement.first()).toBeVisible();
  });
});
