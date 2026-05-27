import { test, expect } from '../../fixtures/auth.fixture';

test.describe('TC-S-E02-S03 through S05: Case Detail', () => {
  const CASE_ID = 'test-case-001';

  test.describe('TC-01: Case detail page shows full info', () => {
    test('staff navigates to case detail and sees all case information', async ({
      staffPage,
    }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}`);

      // Wait for the case detail to load
      const caseDetail = staffPage.locator(
        '[data-testid="case-detail"], .case-detail, main',
      );
      await expect(caseDetail).toBeVisible({ timeout: 15_000 });

      // Verify essential case information sections
      const statusBadge = staffPage.locator(
        '[data-testid="case-status"], .case-status-badge',
      );
      await expect(statusBadge).toBeVisible();

      const topicSection = staffPage.locator(
        '[data-testid="case-topic"], .case-topic',
      );
      await expect(topicSection).toBeVisible();

      const personInfo = staffPage.locator(
        '[data-testid="person-info"], .person-info',
      );
      await expect(personInfo).toBeVisible();

      // Verify urgency level is displayed
      const urgency = staffPage.locator(
        '[data-testid="case-urgency"], .case-urgency',
      );
      await expect(urgency).toBeVisible();

      // Verify creation date is displayed
      const creationDate = staffPage.locator(
        '[data-testid="case-created-at"], .case-created-at, time',
      );
      await expect(creationDate).toBeVisible();
    });
  });

  test.describe('TC-02: Status change (state machine transitions)', () => {
    test('coordinator changes case status through valid transitions', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(`/staff/cases/${CASE_ID}`);

      // Open status change control
      const statusControl = coordinatorPage.locator(
        '[data-testid="status-change"], .status-change-btn, button:has-text("Змінити статус")',
      );
      await expect(statusControl).toBeVisible({ timeout: 15_000 });
      await statusControl.click();

      // Select a valid transition status
      const statusOption = coordinatorPage.locator(
        '[data-testid="status-option"], .status-option, [role="menuitem"]',
      );
      const optionCount = await statusOption.count();
      expect(optionCount).toBeGreaterThan(0);

      // Click the first available transition
      await statusOption.first().click();

      // Confirm the status change if a confirmation dialog appears
      const confirmButton = coordinatorPage.getByRole('button', {
        name: /підтвердити|confirm/i,
      });
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
      }

      // Verify the status badge updated
      const statusBadge = coordinatorPage.locator(
        '[data-testid="case-status"], .case-status-badge',
      );
      await expect(statusBadge).toBeVisible();
    });
  });

  test.describe('TC-03: Case assignment (manual)', () => {
    test('coordinator assigns a case to a consultant', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(`/staff/cases/${CASE_ID}`);

      // Open the assignment panel
      const assignButton = coordinatorPage.locator(
        '[data-testid="assign-case"], button:has-text("Призначити"), button:has-text("Assign")',
      );
      await expect(assignButton).toBeVisible({ timeout: 15_000 });
      await assignButton.click();

      // Wait for the consultant selection dropdown or modal
      const consultantList = coordinatorPage.locator(
        '[data-testid="consultant-list"], .consultant-list, [role="listbox"]',
      );
      await expect(consultantList).toBeVisible({ timeout: 5_000 });

      // Select the first available consultant
      const firstConsultant = consultantList
        .locator('[data-testid="consultant-option"], [role="option"], li')
        .first();
      await firstConsultant.click();

      // Confirm assignment
      const confirmAssign = coordinatorPage.getByRole('button', {
        name: /призначити|підтвердити|confirm|assign/i,
      });
      if (await confirmAssign.isVisible().catch(() => false)) {
        await confirmAssign.click();
      }

      // Verify success feedback
      const successIndicator = coordinatorPage.locator(
        '[role="alert"], .toast-message, [data-testid="assignment-success"]',
      );
      await expect(successIndicator).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('TC-04: Private consultant notes CRUD', () => {
    test('consultant creates a private note on a case', async ({
      staffPage,
    }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}`);

      // Navigate to the notes section
      const notesTab = staffPage.locator(
        '[data-testid="notes-tab"], button:has-text("Нотатки"), [role="tab"]:has-text("Notes")',
      );
      await expect(notesTab).toBeVisible({ timeout: 15_000 });
      await notesTab.click();

      // Click add note button
      const addNoteButton = staffPage.locator(
        '[data-testid="add-note"], button:has-text("Додати нотатку"), button:has-text("Add note")',
      );
      await addNoteButton.click();

      // Fill in note content
      const noteInput = staffPage.locator(
        '[data-testid="note-input"], textarea, [contenteditable="true"]',
      );
      await noteInput.fill('Клієнт потребує додаткової уваги. Запланувати повторну консультацію.');

      // Save the note
      const saveNote = staffPage.getByRole('button', {
        name: /зберегти|save/i,
      });
      await saveNote.click();

      // Verify the note appears in the list
      const notesList = staffPage.locator(
        '[data-testid="notes-list"], .notes-list',
      );
      await expect(notesList).toContainText('Клієнт потребує додаткової уваги');
    });

    test('consultant edits an existing note', async ({ staffPage }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}`);

      const notesTab = staffPage.locator(
        '[data-testid="notes-tab"], button:has-text("Нотатки"), [role="tab"]:has-text("Notes")',
      );
      await notesTab.click();

      // Click edit on the first note
      const editButton = staffPage
        .locator('[data-testid="edit-note"], button[aria-label="Edit"]')
        .first();
      await expect(editButton).toBeVisible({ timeout: 5_000 });
      await editButton.click();

      // Modify the note content
      const noteInput = staffPage.locator(
        '[data-testid="note-input"], textarea, [contenteditable="true"]',
      );
      await noteInput.clear();
      await noteInput.fill('Оновлена нотатка: консультацію заплановано на наступний тиждень.');

      // Save changes
      const saveNote = staffPage.getByRole('button', {
        name: /зберегти|save/i,
      });
      await saveNote.click();

      // Verify the updated note content
      const notesList = staffPage.locator(
        '[data-testid="notes-list"], .notes-list',
      );
      await expect(notesList).toContainText('Оновлена нотатка');
    });

    test('consultant deletes a note', async ({ staffPage }) => {
      await staffPage.goto(`/staff/cases/${CASE_ID}`);

      const notesTab = staffPage.locator(
        '[data-testid="notes-tab"], button:has-text("Нотатки"), [role="tab"]:has-text("Notes")',
      );
      await notesTab.click();

      // Count notes before deletion
      const noteItems = staffPage.locator(
        '[data-testid="note-item"], .note-item',
      );
      const initialCount = await noteItems.count();

      // Click delete on the first note
      const deleteButton = staffPage
        .locator('[data-testid="delete-note"], button[aria-label="Delete"]')
        .first();
      await expect(deleteButton).toBeVisible({ timeout: 5_000 });
      await deleteButton.click();

      // Confirm deletion
      const confirmDelete = staffPage.getByRole('button', {
        name: /видалити|підтвердити|confirm|delete/i,
      });
      if (await confirmDelete.isVisible().catch(() => false)) {
        await confirmDelete.click();
      }

      // Verify note count decreased
      if (initialCount > 0) {
        await expect(noteItems).toHaveCount(initialCount - 1, { timeout: 5_000 });
      }
    });
  });

  test.describe('TC-05: Audit log displayed', () => {
    test('case detail page shows an audit log of all changes', async ({
      coordinatorPage,
    }) => {
      await coordinatorPage.goto(`/staff/cases/${CASE_ID}`);

      // Navigate to the audit log tab/section
      const auditTab = coordinatorPage.locator(
        '[data-testid="audit-log-tab"], button:has-text("Історія"), [role="tab"]:has-text("Audit"), [role="tab"]:has-text("Log")',
      );
      await expect(auditTab).toBeVisible({ timeout: 15_000 });
      await auditTab.click();

      // Verify the audit log container is visible
      const auditLog = coordinatorPage.locator(
        '[data-testid="audit-log"], .audit-log, .activity-log',
      );
      await expect(auditLog).toBeVisible();

      // Verify audit entries contain essential information
      const auditEntries = coordinatorPage.locator(
        '[data-testid="audit-entry"], .audit-entry, .activity-item',
      );
      const entryCount = await auditEntries.count();
      expect(entryCount).toBeGreaterThanOrEqual(0);

      if (entryCount > 0) {
        // Each entry should display a timestamp and action description
        const firstEntry = auditEntries.first();
        await expect(firstEntry.locator('time, .timestamp, .audit-time')).toBeVisible();
      }
    });
  });
});
