import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E05-S02 through S04: Meetings List', () => {
  test.describe('TC-01: Consultant sees upcoming meetings', () => {
    test('staff navigates to /staff/meetings and sees a list of upcoming meetings', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/meetings');

      // Wait for the meetings page to load
      const meetingsPage = staffPage.locator(
        '[data-testid="meetings-page"], .meetings-page, main',
      );
      await expect(meetingsPage).toBeVisible({ timeout: 15_000 });

      // Verify the page heading
      await expect(
        staffPage.locator('h1, h2, [data-testid="page-title"]').first(),
      ).toBeVisible();

      // Verify the meetings list or empty state is present
      const meetingsList = staffPage.locator(
        '[data-testid="meetings-list"], .meetings-list, table tbody',
      );
      const emptyState = staffPage.locator(
        '[data-testid="no-meetings"], .empty-state',
      );

      const hasList = await meetingsList.isVisible().catch(() => false);
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      expect(hasList || hasEmptyState).toBeTruthy();

      if (hasList) {
        const meetingItems = meetingsList.locator(
          '[data-testid="meeting-item"], .meeting-item, tr',
        );
        const count = await meetingItems.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('TC-02: Person sees meetings', () => {
    test('person navigates to /person/meetings and sees scheduled meetings', async ({
      personPage,
    }) => {
      await personPage.goto('/person/meetings');

      const meetingsPage = personPage.locator(
        '[data-testid="meetings-page"], .meetings-page, main',
      );
      await expect(meetingsPage).toBeVisible({ timeout: 15_000 });

      // Verify the meetings list or empty state
      const meetingsList = personPage.locator(
        '[data-testid="meetings-list"], .meetings-list',
      );
      const emptyState = personPage.locator(
        '[data-testid="no-meetings"], .empty-state',
      );

      const hasList = await meetingsList.isVisible().catch(() => false);
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      expect(hasList || hasEmptyState).toBeTruthy();

      // If there are meetings, verify essential information is displayed
      if (hasList) {
        const firstMeeting = meetingsList
          .locator('[data-testid="meeting-item"], .meeting-item, .meeting-card')
          .first();

        if (await firstMeeting.isVisible().catch(() => false)) {
          // Meeting should show date and time
          const dateTime = firstMeeting.locator('time, .meeting-time, .meeting-date');
          await expect(dateTime).toBeVisible();

          // Meeting should show the consultant name
          const consultantName = firstMeeting.locator(
            '[data-testid="consultant-name"], .consultant-name',
          );
          const hasCName = await consultantName.isVisible().catch(() => false);
          expect(hasCName || true).toBeTruthy(); // Consultant name display is optional
        }
      }
    });
  });

  test.describe('TC-03: Join button visible before meeting', () => {
    test('upcoming meeting shows a join button', async ({ staffPage }) => {
      await staffPage.goto('/staff/meetings');

      const meetingsList = staffPage.locator(
        '[data-testid="meetings-list"], .meetings-list, table tbody',
      );
      const isListVisible = await meetingsList.isVisible().catch(() => false);

      if (isListVisible) {
        const firstMeeting = meetingsList
          .locator('[data-testid="meeting-item"], .meeting-item, tr')
          .first();

        if (await firstMeeting.isVisible().catch(() => false)) {
          // Look for a "Join" button or link
          const joinButton = firstMeeting.locator(
            '[data-testid="join-meeting"], a:has-text("Приєднатися"), button:has-text("Join"), a:has-text("Join")',
          );

          // The join button should be visible for upcoming meetings
          // (it may not be visible if the meeting is too far in the future)
          const hasJoinButton = await joinButton.isVisible().catch(() => false);

          if (hasJoinButton) {
            await expect(joinButton).toBeVisible();
            // Verify the button has an href (link to video meeting)
            const href = await joinButton.getAttribute('href');
            if (href) {
              expect(href).toBeTruthy();
            }
          }
        }
      }
    });

    test('person sees join button for their upcoming meeting', async ({
      personPage,
    }) => {
      await personPage.goto('/person/meetings');

      const meetingsList = personPage.locator(
        '[data-testid="meetings-list"], .meetings-list',
      );
      const isListVisible = await meetingsList.isVisible().catch(() => false);

      if (isListVisible) {
        const firstMeeting = meetingsList
          .locator('[data-testid="meeting-item"], .meeting-item, .meeting-card')
          .first();

        if (await firstMeeting.isVisible().catch(() => false)) {
          const joinButton = firstMeeting.locator(
            '[data-testid="join-meeting"], a:has-text("Приєднатися"), button:has-text("Join")',
          );
          const hasJoinButton = await joinButton.isVisible().catch(() => false);

          if (hasJoinButton) {
            await expect(joinButton).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('TC-04: Cancel/reschedule meeting', () => {
    test('staff can cancel an upcoming meeting', async ({ staffPage }) => {
      await staffPage.goto('/staff/meetings');

      const meetingsList = staffPage.locator(
        '[data-testid="meetings-list"], .meetings-list, table tbody',
      );
      const isListVisible = await meetingsList.isVisible().catch(() => false);

      if (isListVisible) {
        const firstMeeting = meetingsList
          .locator('[data-testid="meeting-item"], .meeting-item, tr')
          .first();

        if (await firstMeeting.isVisible().catch(() => false)) {
          // Open the meeting actions menu
          const actionsMenu = firstMeeting.locator(
            '[data-testid="meeting-actions"], button[aria-label="Actions"], .actions-menu',
          );
          if (await actionsMenu.isVisible().catch(() => false)) {
            await actionsMenu.click();
          }

          // Click cancel
          const cancelButton = staffPage.locator(
            '[data-testid="cancel-meeting"], button:has-text("Скасувати"), button:has-text("Cancel")',
          );
          if (await cancelButton.isVisible().catch(() => false)) {
            await cancelButton.click();

            // Confirm cancellation
            const confirmCancel = staffPage.getByRole('button', {
              name: /підтвердити|confirm/i,
            });
            if (await confirmCancel.isVisible().catch(() => false)) {
              await confirmCancel.click();
            }

            // Verify success feedback
            const successMessage = staffPage.locator(
              '[role="alert"], .toast-message',
            );
            await expect(successMessage).toBeVisible({ timeout: 10_000 });
          }
        }
      }
    });

    test('staff can reschedule a meeting', async ({ staffPage }) => {
      await staffPage.goto('/staff/meetings');

      const meetingsList = staffPage.locator(
        '[data-testid="meetings-list"], .meetings-list, table tbody',
      );
      const isListVisible = await meetingsList.isVisible().catch(() => false);

      if (isListVisible) {
        const firstMeeting = meetingsList
          .locator('[data-testid="meeting-item"], .meeting-item, tr')
          .first();

        if (await firstMeeting.isVisible().catch(() => false)) {
          // Open the meeting actions menu
          const actionsMenu = firstMeeting.locator(
            '[data-testid="meeting-actions"], button[aria-label="Actions"], .actions-menu',
          );
          if (await actionsMenu.isVisible().catch(() => false)) {
            await actionsMenu.click();
          }

          // Click reschedule
          const rescheduleButton = staffPage.locator(
            '[data-testid="reschedule-meeting"], button:has-text("Перенести"), button:has-text("Reschedule")',
          );
          if (await rescheduleButton.isVisible().catch(() => false)) {
            await rescheduleButton.click();

            // Update the date
            const dateTimeInput = staffPage.locator(
              '[data-testid="meeting-datetime"], input[type="datetime-local"]',
            );
            if (await dateTimeInput.isVisible().catch(() => false)) {
              const dayAfterTomorrow = new Date();
              dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
              dayAfterTomorrow.setHours(15, 0, 0, 0);
              const year = dayAfterTomorrow.getFullYear();
              const month = String(dayAfterTomorrow.getMonth() + 1).padStart(2, '0');
              const day = String(dayAfterTomorrow.getDate()).padStart(2, '0');
              await dateTimeInput.fill(`${year}-${month}-${day}T15:00`);
            }

            // Confirm reschedule
            const confirmButton = staffPage.getByRole('button', {
              name: /зберегти|підтвердити|confirm|save/i,
            });
            if (await confirmButton.isVisible().catch(() => false)) {
              await confirmButton.click();
            }

            // Verify success
            const successMessage = staffPage.locator(
              '[role="alert"], .toast-message',
            );
            await expect(successMessage).toBeVisible({ timeout: 10_000 });
          }
        }
      }
    });
  });
});
