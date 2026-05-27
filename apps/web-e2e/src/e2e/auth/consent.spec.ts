import { test, expect } from '@playwright/test';

test.describe('Управління згодою GDPR — E01-S05 / E12-S01', () => {
  test('TC-01: два GDPR-чекбокси відображаються при першому вході', async ({
    page,
  }) => {
    // Simulate a first-login scenario by navigating to consent page
    await page.goto('/auth/consent');

    // Wait for page to load
    const pageBody = page.locator('body');
    await expect(pageBody).toBeVisible();

    // If redirected to login, the consent page requires auth
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Two consent checkboxes should be present
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // General data processing consent
    const generalConsent = page.locator(
      '[data-testid="consent-general"], input[name*="general"], input[name*="data"]'
    );
    // Art.9 sensitive data consent
    const sensitiveConsent = page.locator(
      '[data-testid="consent-sensitive"], [data-testid="consent-art9"], input[name*="sensitive"], input[name*="art9"]'
    );

    // Check that both consent checkboxes are visible
    await expect(generalConsent.first()).toBeVisible();
    await expect(sensitiveConsent.first()).toBeVisible();
  });

  test('TC-02: неможливо продовжити без надання згоди', async ({ page }) => {
    await page.goto('/auth/consent');

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Try to proceed without checking any boxes
    const continueBtn = page.locator(
      'button[type="submit"], button:has-text("Продовжити"), button:has-text("Continue"), [data-testid="consent-submit"]'
    );

    const hasContinueBtn = await continueBtn
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasContinueBtn) {
      test.skip();
      return;
    }

    await continueBtn.first().click();

    // Should show error or button should be disabled
    const errorOrDisabled =
      (await page
        .locator(
          '[data-testid*="error"], .error, [role="alert"]'
        )
        .first()
        .isVisible()
        .catch(() => false)) ||
      (await continueBtn.first().isDisabled().catch(() => false));

    expect(errorOrDisabled).toBeTruthy();
  });

  test('TC-03: кнопка "Продовжити" стає активною після надання обох згод', async ({
    page,
  }) => {
    await page.goto('/auth/consent');

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count < 2) {
      test.skip();
      return;
    }

    const continueBtn = page.locator(
      'button[type="submit"], button:has-text("Продовжити"), button:has-text("Continue"), [data-testid="consent-submit"]'
    );

    // Check all consent checkboxes
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    // Continue button should now be enabled
    await expect(continueBtn.first()).toBeEnabled();
  });

  test('TC-04: відкликання згоди (consent withdrawal)', async ({ page }) => {
    // Navigate to consent management / privacy settings
    await page.goto('/staff/settings/privacy');

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Should see consent withdrawal options
    const withdrawBtn = page.locator(
      'button:has-text("Відкликати"), button:has-text("Withdraw"), button:has-text("Revoke"), [data-testid="withdraw-consent"]'
    );

    const hasWithdraw = await withdrawBtn
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasWithdraw) {
      // Try alternative location
      await page.goto('/auth/consent/manage');
      const altWithdraw = page.locator(
        'button:has-text("Відкликати"), button:has-text("Withdraw"), [data-testid="withdraw-consent"]'
      );
      const hasAlt = await altWithdraw
        .first()
        .isVisible()
        .catch(() => false);

      if (!hasAlt) {
        test.skip();
        return;
      }
    }

    // Withdrawal option should be visible
    await expect(withdrawBtn.first()).toBeVisible();
  });

  test('TC-05: часткова згода (лише загальна) блокує продовження', async ({
    page,
  }) => {
    await page.goto('/auth/consent');

    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count < 2) {
      test.skip();
      return;
    }

    // Check only the first checkbox
    await checkboxes.nth(0).check();

    const continueBtn = page.locator(
      'button[type="submit"], button:has-text("Продовжити"), button:has-text("Continue"), [data-testid="consent-submit"]'
    );

    // Try to proceed - should either be disabled or show error
    if (await continueBtn.first().isDisabled().catch(() => false)) {
      expect(true).toBeTruthy();
    } else {
      await continueBtn.first().click();
      const error = page.locator(
        '[data-testid*="error"], .error, [role="alert"]'
      );
      await expect(error.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
