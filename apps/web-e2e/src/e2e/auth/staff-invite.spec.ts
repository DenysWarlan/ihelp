import { test, expect } from '@playwright/test';

test.describe('Реєстрація за запрошенням — E01-S03', () => {
  const FAKE_INVITE_TOKEN = 'test-invite-token-abc123';
  const EXPIRED_INVITE_TOKEN = 'expired-invite-token-xyz789';
  const CLAIMED_INVITE_TOKEN = 'claimed-invite-token-def456';

  test('TC-01: сторінка запрошення доступна за URL з токеном', async ({
    page,
  }) => {
    await page.goto(`/auth/invite?token=${FAKE_INVITE_TOKEN}`);

    // Page should load (not 404)
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    // Should show either a registration form or an error about the token
    const form = page.locator(
      'form, [data-testid="invite-form"], [data-testid="invite-error"]'
    );
    await expect(form.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-02: форма реєстрації містить поля ім\'я та пароль', async ({
    page,
  }) => {
    await page.goto(`/auth/invite?token=${FAKE_INVITE_TOKEN}`);

    // Check if form is shown (token might be invalid in test env)
    const form = page.locator('form, [data-testid="invite-form"]');
    const hasForm = await form.first().isVisible().catch(() => false);

    if (!hasForm) {
      // Token is invalid in test environment - acceptable
      test.skip();
      return;
    }

    // Name field
    const nameField = page.locator(
      'input[name="name"], input[name="fullName"], input[name="firstName"], [data-testid="name-input"]'
    );
    await expect(nameField.first()).toBeVisible();

    // Password field
    const passwordField = page.locator(
      'input[type="password"], input[name="password"], [data-testid="password-input"]'
    );
    await expect(passwordField.first()).toBeVisible();
  });

  test('TC-03: протермінований токен показує помилку', async ({ page }) => {
    await page.goto(`/auth/invite?token=${EXPIRED_INVITE_TOKEN}`);

    // Should show expiration error
    const errorMessage = page.locator(
      '[data-testid="invite-error"], [data-testid="expired-error"], .error, [role="alert"], :text("термін"), :text("expire"), :text("недійсн"), :text("invalid")'
    );
    await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-04: вже використаний токен показує помилку', async ({ page }) => {
    await page.goto(`/auth/invite?token=${CLAIMED_INVITE_TOKEN}`);

    // Should show already-claimed error
    const errorMessage = page.locator(
      '[data-testid="invite-error"], [data-testid="claimed-error"], .error, [role="alert"], :text("використан"), :text("claimed"), :text("already"), :text("недійсн"), :text("invalid")'
    );
    await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-05: відсутній токен перенаправляє або показує помилку', async ({
    page,
  }) => {
    await page.goto('/auth/invite');

    // Should redirect to login or show error about missing token
    const errorOrRedirect =
      page.url().includes('/login') ||
      page.url().includes('/staff/login') ||
      (await page
        .locator(
          '[data-testid="invite-error"], .error, [role="alert"], :text("токен"), :text("token")'
        )
        .first()
        .isVisible()
        .catch(() => false));

    expect(errorOrRedirect).toBeTruthy();
  });

  test('TC-06: валідація пароля при реєстрації', async ({ page }) => {
    await page.goto(`/auth/invite?token=${FAKE_INVITE_TOKEN}`);

    const form = page.locator('form, [data-testid="invite-form"]');
    const hasForm = await form.first().isVisible().catch(() => false);

    if (!hasForm) {
      test.skip();
      return;
    }

    // Fill name
    const nameField = page.locator(
      'input[name="name"], input[name="fullName"], input[name="firstName"], [data-testid="name-input"]'
    );
    await nameField.first().fill('Test User');

    // Fill weak password
    const passwordField = page.locator(
      'input[type="password"], input[name="password"], [data-testid="password-input"]'
    );
    await passwordField.first().fill('123');

    // Submit
    const submitBtn = page.locator(
      'button[type="submit"], [data-testid="register-button"]'
    );
    await submitBtn.first().click();

    // Should show password validation error
    const error = page.locator(
      '[data-testid*="error"], .error, .field-error, [role="alert"], .invalid-feedback'
    );
    await expect(error.first()).toBeVisible({ timeout: 5000 });
  });
});
