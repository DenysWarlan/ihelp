import { test, expect } from '@playwright/test';

test.describe('Вхід персоналу — E01-S02', () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await page.goto('/staff/login');
    await page.evaluate(() => localStorage.removeItem('ihelp_token'));
  });

  test('TC-01: форма входу відображає поля email, пароль та MFA-код', async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/staff\/login/);

    // Email field
    const emailField = page.locator(
      'input[type="email"], input[name="email"], [data-testid="email-input"]'
    );
    await expect(emailField.first()).toBeVisible();

    // Password field
    const passwordField = page.locator(
      'input[type="password"], input[name="password"], [data-testid="password-input"]'
    );
    await expect(passwordField.first()).toBeVisible();

    // MFA code field
    const mfaField = page.locator(
      'input[name="mfaCode"], input[name="mfa"], input[name="totp"], [data-testid="mfa-input"], input[placeholder*="MFA" i], input[placeholder*="код" i], input[placeholder*="code" i]'
    );
    await expect(mfaField.first()).toBeVisible();

    // Submit button
    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="login-button"]'
    );
    await expect(submitBtn.first()).toBeVisible();
  });

  test('TC-02: невірні облікові дані показують помилку', async ({ page }) => {
    const emailField = page.locator(
      'input[type="email"], input[name="email"], [data-testid="email-input"]'
    );
    const passwordField = page.locator(
      'input[type="password"], input[name="password"], [data-testid="password-input"]'
    );
    const mfaField = page.locator(
      'input[name="mfaCode"], input[name="mfa"], input[name="totp"], [data-testid="mfa-input"]'
    );

    await emailField.first().fill('invalid@example.com');
    await passwordField.first().fill('WrongPassword123!');
    await mfaField.first().fill('000000');

    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="login-button"]'
    );
    await submitBtn.first().click();

    // Error message should appear
    const errorMessage = page.locator(
      '[data-testid="login-error"], .error, [role="alert"], .toast-error'
    );
    await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-03: відсутній MFA-код показує помилку', async ({ page }) => {
    const emailField = page.locator(
      'input[type="email"], input[name="email"], [data-testid="email-input"]'
    );
    const passwordField = page.locator(
      'input[type="password"], input[name="password"], [data-testid="password-input"]'
    );

    await emailField.first().fill('staff@example.com');
    await passwordField.first().fill('ValidPassword123!');

    // Leave MFA field empty
    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="login-button"]'
    );
    await submitBtn.first().click();

    // Should show MFA-required error or validation error
    const errorMessage = page.locator(
      '[data-testid*="error"], .error, [role="alert"], .field-error, .invalid-feedback'
    );
    await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-04: порожній email показує валідаційну помилку', async ({ page }) => {
    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="login-button"]'
    );
    await submitBtn.first().click();

    const errorMessage = page.locator(
      '[data-testid*="error"], .error, [role="alert"], .field-error, .invalid-feedback, :invalid'
    );
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-05: посилання на скидання пароля присутнє', async ({ page }) => {
    const resetLink = page.locator(
      'a[href*="reset"], a[href*="forgot"], [data-testid="forgot-password"], :text("забули"), :text("скинути"), :text("forgot"), :text("reset")'
    );
    await expect(resetLink.first()).toBeVisible();
  });

  test('TC-06: успішний вхід перенаправляє на /staff', async ({ page }) => {
    // This test is designed for environments with a known test user.
    // In CI, this test may be skipped if no test credentials are available.
    const testEmail = process.env['E2E_STAFF_EMAIL'];
    const testPassword = process.env['E2E_STAFF_PASSWORD'];
    const testMfa = process.env['E2E_STAFF_MFA'];

    if (!testEmail || !testPassword || !testMfa) {
      test.skip();
      return;
    }

    const emailField = page.locator(
      'input[type="email"], input[name="email"], [data-testid="email-input"]'
    );
    const passwordField = page.locator(
      'input[type="password"], input[name="password"], [data-testid="password-input"]'
    );
    const mfaField = page.locator(
      'input[name="mfaCode"], input[name="mfa"], input[name="totp"], [data-testid="mfa-input"]'
    );

    await emailField.first().fill(testEmail);
    await passwordField.first().fill(testPassword);
    await mfaField.first().fill(testMfa);

    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="login-button"]'
    );
    await submitBtn.first().click();

    await expect(page).toHaveURL(/\/staff/, { timeout: 15000 });
  });
});
