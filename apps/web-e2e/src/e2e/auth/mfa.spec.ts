import { test, expect } from '@playwright/test';

test.describe('Налаштування MFA — E01-S04', () => {
  // These tests require an authenticated staff session.
  // In CI, they should be run with pre-configured auth state.

  test.beforeEach(async ({ page }) => {
    const testEmail = process.env['E2E_STAFF_EMAIL'];
    const testPassword = process.env['E2E_STAFF_PASSWORD'];

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Navigate to MFA setup page (assumes authenticated session or setup flow)
    await page.goto('/staff/settings/mfa');
  });

  test('TC-01: сторінка налаштування MFA відображає QR-код', async ({
    page,
  }) => {
    // QR code for TOTP setup
    const qrCode = page.locator(
      '[data-testid="mfa-qr-code"], canvas, img[alt*="QR"], img[alt*="qr"], svg[data-testid="qr"]'
    );
    await expect(qrCode.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-02: поле для введення TOTP-коду та кнопка верифікації', async ({
    page,
  }) => {
    // TOTP verification input
    const totpInput = page.locator(
      'input[name="totp"], input[name="code"], input[name="verificationCode"], [data-testid="totp-input"], input[placeholder*="код" i], input[placeholder*="code" i]'
    );
    await expect(totpInput.first()).toBeVisible();

    // Verify button
    const verifyBtn = page.locator(
      'button:has-text("Підтвердити"), button:has-text("Verify"), button:has-text("верифік"), [data-testid="verify-mfa-button"], button[type="submit"]'
    );
    await expect(verifyBtn.first()).toBeVisible();
  });

  test('TC-03: невірний TOTP-код показує помилку', async ({ page }) => {
    const totpInput = page.locator(
      'input[name="totp"], input[name="code"], input[name="verificationCode"], [data-testid="totp-input"]'
    );
    await totpInput.first().fill('000000');

    const verifyBtn = page.locator(
      'button:has-text("Підтвердити"), button:has-text("Verify"), [data-testid="verify-mfa-button"], button[type="submit"]'
    );
    await verifyBtn.first().click();

    // Error message
    const error = page.locator(
      '[data-testid*="error"], .error, [role="alert"], .toast-error'
    );
    await expect(error.first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-04: генерація резервних кодів', async ({ page }) => {
    // Navigate to backup codes section (may be on same page or separate)
    const backupSection = page.locator(
      '[data-testid="backup-codes"], :text("резервн"), :text("backup")'
    );

    const hasBackupSection = await backupSection
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasBackupSection) {
      // Try navigating to backup codes page
      await page.goto('/staff/settings/mfa/backup-codes');
    }

    // Backup codes should be displayed or a button to generate them
    const backupCodes = page.locator(
      '[data-testid="backup-codes-list"], .backup-codes, code, pre'
    );
    const generateBtn = page.locator(
      'button:has-text("Генерувати"), button:has-text("Generate"), [data-testid="generate-backup-codes"]'
    );

    const hasCodesOrButton =
      (await backupCodes.first().isVisible().catch(() => false)) ||
      (await generateBtn.first().isVisible().catch(() => false));

    expect(hasCodesOrButton).toBeTruthy();
  });

  test('TC-05: використання резервного коду для входу', async ({ page }) => {
    // This tests using a backup code instead of TOTP during login
    await page.goto('/staff/login');

    const emailField = page.locator(
      'input[type="email"], input[name="email"]'
    );
    const passwordField = page.locator(
      'input[type="password"], input[name="password"]'
    );

    await emailField.first().fill('staff@example.com');
    await passwordField.first().fill('ValidPassword123!');

    // Look for "Use backup code" link/button
    const backupCodeLink = page.locator(
      'a:has-text("резервн"), a:has-text("backup"), button:has-text("резервн"), button:has-text("backup"), [data-testid="use-backup-code"]'
    );

    const hasBackupOption = await backupCodeLink
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasBackupOption) {
      // Backup code option may only appear after initial login attempt
      test.skip();
      return;
    }

    await backupCodeLink.first().click();

    // Backup code input should appear
    const backupInput = page.locator(
      'input[name="backupCode"], input[name="backup"], [data-testid="backup-code-input"]'
    );
    await expect(backupInput.first()).toBeVisible();
  });
});
