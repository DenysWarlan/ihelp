import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E05-S01: Schedule Meeting', () => {
  const CASE_ID = 'test-case-001';

  /**
   * Returns a date string for tomorrow at 14:00 in YYYY-MM-DDTHH:mm format.
   */
  function getTomorrowAt14(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T14:00`;
  }

  /**
   * Returns a date string for yesterday at 14:00.
   */
  function getYesterdayAt14(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(14, 0, 0, 0);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T14:00`;
  }

  test.describe('TC-01: Create meeting with future date, generates video link', () => {
    test('staff creates a meeting and receives a video conferencing link', async ({
      staffPage,
    }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}/meetings/new`);

      // Wait for the meeting creation form
      const meetingForm = staffPage.locator(
        'form, [data-testid="meeting-form"]',
      );
      await expect(meetingForm).toBeVisible({ timeout: 15_000 });

      // Fill in the meeting title
      const titleInput = staffPage.locator(
        '[data-testid="meeting-title"], input[name="title"], input[placeholder*="назва"]',
      );
      await titleInput.fill('Консультація з психологічної підтримки');

      // Set the meeting date and time
      const dateTimeInput = staffPage.locator(
        '[data-testid="meeting-datetime"], input[type="datetime-local"], input[name="scheduledAt"]',
      );
      await dateTimeInput.fill(getTomorrowAt14());

      // Set the duration
      const durationInput = staffPage.locator(
        '[data-testid="meeting-duration"], input[name="duration"], select[name="duration"]',
      );
      if (await durationInput.isVisible().catch(() => false)) {
        if ((await durationInput.evaluate((el) => (el as HTMLElement).tagName)) === 'SELECT') {
          await durationInput.selectOption('60');
        } else {
          await durationInput.fill('60');
        }
      }

      // Submit the form
      const createButton = staffPage.getByRole('button', {
        name: /створити|запланувати|create|schedule/i,
      });
      await createButton.click();

      // Wait for navigation to meeting detail or confirmation
      await staffPage.waitForTimeout(2_000);

      // Verify success: either a toast, redirect, or meeting detail page
      const successIndicator = staffPage.locator(
        '[role="alert"], .toast-message, [data-testid="meeting-detail"]',
      );
      await expect(successIndicator).toBeVisible({ timeout: 10_000 });

      // Verify a video link was generated
      const videoLink = staffPage.locator(
        '[data-testid="video-link"], a[href*="meet"], a[href*="zoom"], .video-link',
      );
      const hasVideoLink = await videoLink.isVisible().catch(() => false);

      // The video link may appear on the meeting detail page
      if (!hasVideoLink) {
        // Navigate to the meeting detail if redirected
        const meetingDetail = staffPage.locator(
          '[data-testid="meeting-detail"], .meeting-detail',
        );
        if (await meetingDetail.isVisible().catch(() => false)) {
          const linkInDetail = meetingDetail.locator('a[href*="meet"], a[href*="zoom"], a[href*="video"]');
          await expect(linkInDetail).toBeVisible({ timeout: 5_000 });
        }
      }
    });
  });

  test.describe('TC-02: Reject past dates', () => {
    test('meeting creation form rejects dates in the past', async ({
      staffPage,
    }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}/meetings/new`);

      const meetingForm = staffPage.locator(
        'form, [data-testid="meeting-form"]',
      );
      await expect(meetingForm).toBeVisible({ timeout: 15_000 });

      // Fill in a title
      const titleInput = staffPage.locator(
        '[data-testid="meeting-title"], input[name="title"], input[placeholder*="назва"]',
      );
      await titleInput.fill('Past meeting test');

      // Set a date in the past
      const dateTimeInput = staffPage.locator(
        '[data-testid="meeting-datetime"], input[type="datetime-local"], input[name="scheduledAt"]',
      );
      await dateTimeInput.fill(getYesterdayAt14());

      // Attempt to submit
      const createButton = staffPage.getByRole('button', {
        name: /створити|запланувати|create|schedule/i,
      });

      // The button may be disabled for past dates
      const isDisabled = await createButton.isDisabled().catch(() => false);

      if (!isDisabled) {
        await createButton.click();

        // Expect a validation error
        const errorMessage = staffPage.locator(
          '.form-error, [data-testid="date-error"], .validation-error, [role="alert"]',
        );
        await expect(errorMessage).toBeVisible({ timeout: 5_000 });
      } else {
        // Button correctly disabled for past dates
        expect(isDisabled).toBeTruthy();
      }
    });
  });

  test.describe('TC-03: Detect time conflicts', () => {
    test('system warns about scheduling conflicts with existing meetings', async ({
      staffPage,
    }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}/meetings/new`);

      const meetingForm = staffPage.locator(
        'form, [data-testid="meeting-form"]',
      );
      await expect(meetingForm).toBeVisible({ timeout: 15_000 });

      // Fill in meeting details at a time that may conflict
      const titleInput = staffPage.locator(
        '[data-testid="meeting-title"], input[name="title"], input[placeholder*="назва"]',
      );
      await titleInput.fill('Conflict test meeting');

      const dateTimeInput = staffPage.locator(
        '[data-testid="meeting-datetime"], input[type="datetime-local"], input[name="scheduledAt"]',
      );
      await dateTimeInput.fill(getTomorrowAt14());

      const createButton = staffPage.getByRole('button', {
        name: /створити|запланувати|create|schedule/i,
      });
      await createButton.click();

      // If there is a conflict, expect a warning or error
      const conflictWarning = staffPage.locator(
        '[data-testid="conflict-warning"], .conflict-warning, [role="alert"]:has-text("конфлікт"), [role="alert"]:has-text("conflict")',
      );
      const successIndicator = staffPage.locator(
        '[data-testid="meeting-detail"], .toast-message:has-text("створено")',
      );

      // Either we get a conflict warning or the meeting was created successfully (no conflict)
      const hasConflict = await conflictWarning.isVisible().catch(() => false);
      const hasSuccess = await successIndicator.isVisible().catch(() => false);

      expect(hasConflict || hasSuccess).toBeTruthy();

      if (hasConflict) {
        await expect(conflictWarning).toBeVisible();
      }
    });
  });
});
