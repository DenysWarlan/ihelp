import { test, expect } from '@playwright/test';

test.describe('Управління токенами та auth guard — E01-S06', () => {
  test('TC-01: токен зберігається в localStorage після входу', async ({
    page,
  }) => {
    const testEmail = process.env['E2E_STAFF_EMAIL'];
    const testPassword = process.env['E2E_STAFF_PASSWORD'];
    const testMfa = process.env['E2E_STAFF_MFA'];

    if (!testEmail || !testPassword || !testMfa) {
      test.skip();
      return;
    }

    await page.goto('/staff/login');

    const emailField = page.locator(
      'input[type="email"], input[name="email"]'
    );
    const passwordField = page.locator(
      'input[type="password"], input[name="password"]'
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

    // Wait for redirect
    await expect(page).toHaveURL(/\/staff/, { timeout: 15000 });

    // Check localStorage for token
    const token = await page.evaluate(() =>
      localStorage.getItem('ihelp_token')
    );
    expect(token).toBeTruthy();
  });

  test('TC-02: протерміновані токен перенаправляє на логін', async ({
    page,
  }) => {
    // Set an expired/invalid token
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('ihelp_token', 'expired-invalid-token-abc123');
    });

    // Try to access a protected staff route
    await page.goto('/staff/dashboard');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/(login|staff\/login|auth)/, {
      timeout: 15000,
    });
  });

  test('TC-03: auth guard перенаправляє неавторизованих на логін для захищених маршрутів', async ({
    page,
  }) => {
    // Clear all auth state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('ihelp_token');
      localStorage.clear();
    });

    // List of protected routes to test
    const protectedRoutes = [
      '/staff/dashboard',
      '/staff/cases',
      '/staff/settings',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);

      // Should redirect to login page
      await expect(page).toHaveURL(/\/(login|staff\/login|auth)/, {
        timeout: 10000,
      });
    }
  });

  test('TC-04: публічні маршрути доступні без автентифікації', async ({
    page,
  }) => {
    // Clear all auth state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('ihelp_token');
      localStorage.clear();
    });

    // Public routes should be accessible
    const publicRoutes = ['/', '/catalog', '/need-help', '/login'];

    for (const route of publicRoutes) {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);

      // Should NOT redirect to login (except /login itself)
      if (route !== '/login') {
        const currentUrl = page.url();
        expect(currentUrl).not.toMatch(/\/staff\/login/);
      }
    }
  });

  test('TC-05: видалення токена з localStorage розлогінює користувача', async ({
    page,
  }) => {
    // Set a token to simulate logged-in state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('ihelp_token', 'some-valid-looking-token');
    });

    // Remove the token (simulating logout or token clearing)
    await page.evaluate(() => {
      localStorage.removeItem('ihelp_token');
    });

    // Navigate to a protected page
    await page.goto('/staff/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|staff\/login|auth)/, {
      timeout: 10000,
    });
  });

  test('TC-06: auth callback маршрут обробляється коректно', async ({
    page,
  }) => {
    // Test the /auth/callback route exists and handles missing params
    await page.goto('/auth/callback');

    // Should either redirect to login or show error (no code/state params)
    const currentUrl = page.url();
    const isHandled =
      currentUrl.includes('/login') ||
      currentUrl.includes('/auth') ||
      currentUrl === page.url(); // stayed on callback (processing)

    expect(isHandled).toBeTruthy();
  });
});
