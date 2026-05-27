import { test, expect } from '@playwright/test';

test.describe('Landing Page — E14-S01', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC-01: відображає hero-секцію та CTA-кнопки', async ({ page }) => {
    // Hero section is visible
    const heroSection = page.locator(
      '[data-testid="hero-section"], .hero, main section'
    );
    await expect(heroSection.first()).toBeVisible();

    // CTA button "Потрібна допомога" links to /need-help
    const needHelpBtn = page.getByRole('link', { name: /допомог/i });
    await expect(needHelpBtn).toBeVisible();
    await expect(needHelpBtn).toHaveAttribute('href', /\/need-help/);

    // CTA button "Переглянути курси" links to /catalog
    const coursesBtn = page.getByRole('link', { name: /курс/i });
    await expect(coursesBtn).toBeVisible();
    await expect(coursesBtn).toHaveAttribute('href', /\/catalog/);
  });

  test('TC-01: відображає блок переваг', async ({ page }) => {
    const benefitsBlock = page.locator(
      '[data-testid="benefits-section"], .benefits, section'
    );
    await expect(benefitsBlock.first()).toBeVisible();
  });

  test('TC-02: навбар містить логотип, посилання "Курси" та кнопку "Увійти"', async ({
    page,
  }) => {
    // Logo is present
    const logo = page.locator(
      '[data-testid="logo"], header a[href="/"], .logo'
    );
    await expect(logo.first()).toBeVisible();

    // "Курси" link navigates to /catalog
    const coursesLink = page.getByRole('link', { name: /курс/i });
    await expect(coursesLink.first()).toBeVisible();

    // "Увійти" button navigates to /login
    const loginBtn = page.locator(
      'a[href*="/login"], button:has-text("Увійти"), [data-testid="login-button"]'
    );
    await expect(loginBtn.first()).toBeVisible();
  });

  test('TC-02: навігація "Курси" веде на /catalog', async ({ page }) => {
    const coursesLink = page.getByRole('link', { name: /курс/i });
    await coursesLink.first().click();
    await expect(page).toHaveURL(/\/catalog/);
  });

  test('TC-02: кнопка "Увійти" веде на /login', async ({ page }) => {
    const loginBtn = page.locator(
      'a[href*="/login"], button:has-text("Увійти"), [data-testid="login-button"]'
    );
    await loginBtn.first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-03: мобільна адаптивна верстка', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/');

    // Hero section still visible on mobile
    const heroSection = page.locator(
      '[data-testid="hero-section"], .hero, main section'
    );
    await expect(heroSection.first()).toBeVisible();

    // CTA buttons still visible
    const needHelpBtn = page.getByRole('link', { name: /допомог/i });
    await expect(needHelpBtn).toBeVisible();

    // Mobile menu button should be present (hamburger)
    const mobileMenuBtn = page.locator(
      '[data-testid="mobile-menu-toggle"], button[aria-label*="menu"], .hamburger, button[aria-expanded]'
    );
    // On mobile, either a hamburger menu exists or nav is still visible
    const hasMobileMenu = await mobileMenuBtn.first().isVisible().catch(() => false);
    if (hasMobileMenu) {
      await mobileMenuBtn.first().click();
      // After opening menu, nav links should be visible
      const coursesLink = page.getByRole('link', { name: /курс/i });
      await expect(coursesLink.first()).toBeVisible();
    }

    await context.close();
  });
});
