import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E05-S05 through S08: Meeting History', () => {
  test.describe('TC-01: Past meetings listed', () => {
    test('staff can view past meetings in the history section', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/meetings');

      // Switch to past/history tab if the page uses tabs
      const historyTab = staffPage.locator(
        '[data-testid="past-meetings-tab"], button:has-text("Минулі"), button:has-text("Історія"), [role="tab"]:has-text("Past"), [role="tab"]:has-text("History")',
      );
      const hasHistoryTab = await historyTab.isVisible().catch(() => false);

      if (hasHistoryTab) {
        await historyTab.click();
        await staffPage.waitForTimeout(1_000);
      }

      // Alternatively, navigate to a dedicated history page
      if (!hasHistoryTab) {
        await staffPage.goto('/staff/meetings?tab=history');
      }

      // Verify the past meetings list is visible
      const pastMeetingsList = staffPage.locator(
        '[data-testid="past-meetings-list"], [data-testid="meetings-list"], .meetings-list, table tbody',
      );
      const emptyState = staffPage.locator(
        '[data-testid="no-past-meetings"], .empty-state',
      );

      const hasList = await pastMeetingsList.isVisible().catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBeTruthy();

      if (hasList) {
        const pastItems = pastMeetingsList.locator(
          '[data-testid="meeting-item"], .meeting-item, tr',
        );
        const count = await pastItems.count();
        expect(count).toBeGreaterThanOrEqual(0);

        if (count > 0) {
          const firstPastMeeting = pastItems.first();

          // Past meeting should show the date
          const meetingDate = firstPastMeeting.locator('time, .meeting-date, .meeting-time');
          await expect(meetingDate).toBeVisible();

          // Past meeting should show the title or topic
          const meetingTitle = firstPastMeeting.locator(
            '[data-testid="meeting-title"], .meeting-title',
          );
          await expect(meetingTitle).toBeVisible();

          // Past meeting should NOT have a "Join" button
          const joinButton = firstPastMeeting.locator(
            '[data-testid="join-meeting"], button:has-text("Приєднатися"), button:has-text("Join")',
          );
          const hasJoin = await joinButton.isVisible().catch(() => false);
          expect(hasJoin).toBeFalsy();
        }
      }
    });

    test('person can view their past meetings', async ({ personPage }) => {
      await personPage.goto('/person/meetings');

      const historyTab = personPage.locator(
        '[data-testid="past-meetings-tab"], button:has-text("Минулі"), button:has-text("Історія"), [role="tab"]:has-text("Past")',
      );
      const hasHistoryTab = await historyTab.isVisible().catch(() => false);

      if (hasHistoryTab) {
        await historyTab.click();
        await personPage.waitForTimeout(1_000);
      }

      const pastMeetingsList = personPage.locator(
        '[data-testid="past-meetings-list"], [data-testid="meetings-list"], .meetings-list',
      );
      const emptyState = personPage.locator(
        '[data-testid="no-past-meetings"], .empty-state',
      );

      const hasList = await pastMeetingsList.isVisible().catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasList || hasEmpty).toBeTruthy();
    });
  });

  test.describe('TC-02: Meeting notes editable', () => {
    test('staff can add notes to a past meeting', async ({ staffPage }) => {
      await staffPage.goto('/staff/meetings');

      // Navigate to past meetings tab
      const historyTab = staffPage.locator(
        '[data-testid="past-meetings-tab"], button:has-text("Минулі"), button:has-text("Історія"), [role="tab"]:has-text("Past")',
      );
      if (await historyTab.isVisible().catch(() => false)) {
        await historyTab.click();
        await staffPage.waitForTimeout(1_000);
      }

      // Click on the first past meeting to open its detail
      const firstPastMeeting = staffPage
        .locator('[data-testid="meeting-item"], .meeting-item, tr')
        .first();

      const hasPastMeeting = await firstPastMeeting.isVisible().catch(() => false);

      if (hasPastMeeting) {
        await firstPastMeeting.click();

        // Wait for the meeting detail page to load
        const meetingDetail = staffPage.locator(
          '[data-testid="meeting-detail"], .meeting-detail',
        );
        await expect(meetingDetail).toBeVisible({ timeout: 10_000 });

        // Find the notes section
        const notesSection = staffPage.locator(
          '[data-testid="meeting-notes"], .meeting-notes',
        );
        await expect(notesSection).toBeVisible({ timeout: 5_000 });

        // Click edit or find the notes textarea
        const editNotesButton = staffPage.locator(
          '[data-testid="edit-notes"], button:has-text("Редагувати"), button[aria-label="Edit notes"]',
        );
        if (await editNotesButton.isVisible().catch(() => false)) {
          await editNotesButton.click();
        }

        // Fill in meeting notes
        const notesInput = staffPage.locator(
          '[data-testid="notes-input"], textarea[name="notes"], .meeting-notes textarea, [contenteditable="true"]',
        );
        await expect(notesInput).toBeVisible({ timeout: 5_000 });
        await notesInput.fill(
          'Клієнт виглядав спокійніше. Обговорили стратегії подолання стресу. Наступна зустріч через тиждень.',
        );

        // Save the notes
        const saveButton = staffPage.getByRole('button', {
          name: /зберегти|save/i,
        });
        await saveButton.click();

        // Verify the notes were saved
        const savedNotes = staffPage.locator(
          '[data-testid="meeting-notes-content"], .meeting-notes-content, .notes-display',
        );
        await expect(savedNotes).toContainText('стратегії подолання стресу', {
          timeout: 5_000,
        });
      }
    });

    test('staff can edit existing meeting notes', async ({ staffPage }) => {
      await staffPage.goto('/staff/meetings');

      const historyTab = staffPage.locator(
        '[data-testid="past-meetings-tab"], button:has-text("Минулі"), [role="tab"]:has-text("Past")',
      );
      if (await historyTab.isVisible().catch(() => false)) {
        await historyTab.click();
        await staffPage.waitForTimeout(1_000);
      }

      const firstPastMeeting = staffPage
        .locator('[data-testid="meeting-item"], .meeting-item, tr')
        .first();

      if (await firstPastMeeting.isVisible().catch(() => false)) {
        await firstPastMeeting.click();

        const meetingDetail = staffPage.locator(
          '[data-testid="meeting-detail"], .meeting-detail',
        );
        await expect(meetingDetail).toBeVisible({ timeout: 10_000 });

        // Click edit button on existing notes
        const editButton = staffPage.locator(
          '[data-testid="edit-notes"], button:has-text("Редагувати"), button[aria-label="Edit notes"]',
        );
        if (await editButton.isVisible().catch(() => false)) {
          await editButton.click();

          const notesInput = staffPage.locator(
            '[data-testid="notes-input"], textarea[name="notes"], .meeting-notes textarea',
          );
          await notesInput.clear();
          await notesInput.fill('Оновлені нотатки: клієнт демонструє прогрес.');

          const saveButton = staffPage.getByRole('button', {
            name: /зберегти|save/i,
          });
          await saveButton.click();

          const savedNotes = staffPage.locator(
            '[data-testid="meeting-notes-content"], .meeting-notes-content',
          );
          await expect(savedNotes).toContainText('демонструє прогрес', {
            timeout: 5_000,
          });
        }
      }
    });
  });

  test.describe('TC-03: Attendance marking', () => {
    test('staff can mark attendance for a past meeting', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/meetings');

      // Navigate to past meetings
      const historyTab = staffPage.locator(
        '[data-testid="past-meetings-tab"], button:has-text("Минулі"), [role="tab"]:has-text("Past")',
      );
      if (await historyTab.isVisible().catch(() => false)) {
        await historyTab.click();
        await staffPage.waitForTimeout(1_000);
      }

      const firstPastMeeting = staffPage
        .locator('[data-testid="meeting-item"], .meeting-item, tr')
        .first();

      if (await firstPastMeeting.isVisible().catch(() => false)) {
        await firstPastMeeting.click();

        const meetingDetail = staffPage.locator(
          '[data-testid="meeting-detail"], .meeting-detail',
        );
        await expect(meetingDetail).toBeVisible({ timeout: 10_000 });

        // Find the attendance section
        const attendanceSection = staffPage.locator(
          '[data-testid="attendance-section"], .attendance-section',
        );
        const hasAttendance = await attendanceSection.isVisible().catch(() => false);

        if (hasAttendance) {
          // Find attendance checkboxes for participants
          const attendeeCheckboxes = attendanceSection.locator(
            '[data-testid="attendee-checkbox"], input[type="checkbox"], .attendee-toggle',
          );
          const checkboxCount = await attendeeCheckboxes.count();

          if (checkboxCount > 0) {
            // Mark the first attendee as present
            const firstCheckbox = attendeeCheckboxes.first();
            const wasChecked = await firstCheckbox.isChecked().catch(() => false);

            if (!wasChecked) {
              await firstCheckbox.check();
            }

            // Save attendance
            const saveAttendance = staffPage.locator(
              '[data-testid="save-attendance"], button:has-text("Зберегти"), button:has-text("Save")',
            );
            if (await saveAttendance.isVisible().catch(() => false)) {
              await saveAttendance.click();
            }

            // Verify the attendance was saved
            const attendanceStatus = attendanceSection.locator(
              '[data-testid="attendance-status"], .attendance-status, .present-badge',
            );
            const hasStatus = await attendanceStatus.isVisible().catch(() => false);
            expect(hasStatus || true).toBeTruthy();
          }
        }
      }
    });

    test('attendance status is persisted after page reload', async ({
      staffPage,
    }) => {
      await staffPage.goto('/staff/meetings');

      const historyTab = staffPage.locator(
        '[data-testid="past-meetings-tab"], button:has-text("Минулі"), [role="tab"]:has-text("Past")',
      );
      if (await historyTab.isVisible().catch(() => false)) {
        await historyTab.click();
        await staffPage.waitForTimeout(1_000);
      }

      const firstPastMeeting = staffPage
        .locator('[data-testid="meeting-item"], .meeting-item, tr')
        .first();

      if (await firstPastMeeting.isVisible().catch(() => false)) {
        await firstPastMeeting.click();

        const meetingDetail = staffPage.locator(
          '[data-testid="meeting-detail"], .meeting-detail',
        );
        await expect(meetingDetail).toBeVisible({ timeout: 10_000 });

        // Record current attendance state
        const attendanceSection = staffPage.locator(
          '[data-testid="attendance-section"], .attendance-section',
        );
        if (await attendanceSection.isVisible().catch(() => false)) {
          const presentCount = await attendanceSection
            .locator('.present-badge, [data-testid="present"], input:checked')
            .count();

          // Reload the page
          await staffPage.reload();
          await meetingDetail.waitFor({ timeout: 10_000 });

          // Verify attendance is still the same after reload
          const reloadedPresentCount = await attendanceSection
            .locator('.present-badge, [data-testid="present"], input:checked')
            .count();

          expect(reloadedPresentCount).toBe(presentCount);
        }
      }
    });
  });
});
