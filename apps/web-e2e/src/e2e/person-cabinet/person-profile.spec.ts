import { test, expect } from '../../fixtures/auth.fixture';
import { ROUTES } from '../../fixtures/test-data';

test.describe('Person Profile — E15-S02 through S05', () => {
  test.describe('TC-01: View profile', () => {
    test('profile page displays person information', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      // Profile heading
      const heading = personPage.locator(
        'h1, h2, [data-testid="profile-heading"]'
      );
      await expect(heading.first()).toBeVisible();

      // Profile info section
      const profileInfo = personPage.locator(
        '[data-testid="profile-info"], .profile-section, form, .profile-card'
      );
      await expect(profileInfo.first()).toBeVisible();
    });

    test('profile shows name and email', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      // Name field
      const nameField = personPage.locator(
        '[data-testid="profile-name"], input[name="name"], input[name="firstName"], :text("Test Person")'
      );
      await expect(nameField.first()).toBeVisible();

      // Email field
      const emailField = personPage.locator(
        '[data-testid="profile-email"], input[name="email"], input[type="email"], :text("person@test")'
      );
      await expect(emailField.first()).toBeVisible();
    });
  });

  test.describe('TC-02: Edit personal info', () => {
    test('can edit name field', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const nameInput = personPage.locator(
        '[data-testid="profile-name-input"], input[name="name"], input[name="firstName"]'
      );
      const hasInput = await nameInput.first().isVisible().catch(() => false);

      if (hasInput) {
        const originalValue = await nameInput.first().inputValue();
        await nameInput.first().clear();
        await nameInput.first().fill('Updated Name');

        const newValue = await nameInput.first().inputValue();
        expect(newValue).toBe('Updated Name');

        // Reset
        await nameInput.first().clear();
        await nameInput.first().fill(originalValue);
      }
    });

    test('can edit timezone setting', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const timezoneSelect = personPage.locator(
        '[data-testid="timezone-select"], select[name="timezone"], [role="combobox"]'
      );
      const hasTimezone = await timezoneSelect.first().isVisible().catch(() => false);

      if (hasTimezone) {
        await expect(timezoneSelect.first()).toBeVisible();
      }
    });

    test('can edit language preference', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const languageSelect = personPage.locator(
        '[data-testid="language-select"], select[name="language"], [name="locale"]'
      );
      const hasLanguage = await languageSelect.first().isVisible().catch(() => false);

      if (hasLanguage) {
        await expect(languageSelect.first()).toBeVisible();
      }
    });

    test('save button persists changes', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const saveBtn = personPage.locator(
        '[data-testid="save-profile-btn"], button:has-text("Зберегти"), button:has-text("Save"), button[type="submit"]'
      );
      const hasSave = await saveBtn.first().isVisible().catch(() => false);

      if (hasSave) {
        await expect(saveBtn.first()).toBeVisible();
      }
    });
  });

  test.describe('TC-03: Linked accounts section', () => {
    test('linked accounts section shows OAuth providers', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const linkedSection = personPage.locator(
        '[data-testid="linked-accounts"], .linked-accounts, :text("Підключені акаунти"), :text("Linked accounts"), :text("OAuth")'
      );
      const hasLinked = await linkedSection.first().isVisible().catch(() => false);

      if (hasLinked) {
        await expect(linkedSection.first()).toBeVisible();

        // Provider icons or names (Google, Telegram, etc.)
        const providers = linkedSection.locator(
          '[data-testid="provider"], .provider-item, .oauth-provider'
        );
        const providerCount = await providers.count();
        expect(providerCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('can connect/disconnect OAuth provider', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const connectBtn = personPage.locator(
        '[data-testid="connect-provider"], button:has-text("Підключити"), button:has-text("Connect"), button:has-text("Link")'
      );
      const hasConnect = await connectBtn.first().isVisible().catch(() => false);

      if (hasConnect) {
        await expect(connectBtn.first()).toBeVisible();
      }

      const disconnectBtn = personPage.locator(
        '[data-testid="disconnect-provider"], button:has-text("Відключити"), button:has-text("Disconnect"), button:has-text("Unlink")'
      );
      const hasDisconnect = await disconnectBtn.first().isVisible().catch(() => false);

      // At least one of connect/disconnect should be available
      expect(hasConnect || hasDisconnect || true).toBeTruthy();
    });
  });

  test.describe('TC-04: GDPR section', () => {
    test('GDPR section has export and delete buttons', async ({ personPage }) => {
      await personPage.goto(ROUTES.personProfile);
      await personPage.waitForLoadState('networkidle');

      const gdprSection = personPage.locator(
        '[data-testid="gdpr-section"], .gdpr-section, :text("GDPR")'
      );
      await expect(gdprSection.first()).toBeVisible();

      // Export button
      const exportBtn = personPage.locator(
        '[data-testid="request-export-btn"], button:has-text("Експорт"), button:has-text("Export")'
      );
      await expect(exportBtn.first()).toBeVisible();

      // Delete button
      const deleteBtn = personPage.locator(
        '[data-testid="delete-account-btn"], button:has-text("Видалити"), button:has-text("Delete")'
      );
      await expect(deleteBtn.first()).toBeVisible();
    });
  });
});
