---
title: "Course Delete with Confirmation Modal"
type: feature-spec
status: in-progress
created: 2026-06-07
epic: "vault/30-bmad/epics/E04-lms.md"
story: "vault/30-bmad/stories/E04-lms/S-E04-13.md"
author: Dev
baseline_commit: fca9427
context:
  - "vault/30-bmad/prd.md"
  - "vault/30-bmad/architecture/architecture.md"
---

# Фіча: Course Delete with Confirmation Modal

## Контекст

S-E04-13: Backend soft delete exists (DELETE /api/admin/courses/:id), store.deleteCourse and service.deleteCourse are implemented. Frontend needs delete button in course-edit header + confirmation modal.

## Задача

Add a Delete button (Trash2, danger) to course-edit header for HIDDEN/DRAFT courses, with a confirmation modal showing course title and warning text. On confirm, call facade.deleteCourse(id) and navigate to course list.

## Технічний план

### Файли для створення/зміни

| Файл | Дія | Опис |
|---|---|---|
| libs/staff/data-access/service/course-manage-facade.service.ts | Change | Add showDeleteModal signal, openDeleteModal(), closeDeleteModal(), confirmDeleteCourse() |
| libs/staff/components/course-edit/course-edit.component.ts | Change | Add onDelete(), onConfirmDelete(), onCancelDelete() methods |
| libs/staff/components/course-edit/course-edit.component.html | Change | Add delete button in header, add confirmation modal |
| apps/web/src/assets/i18n/uk.json | Change | Add delete-related i18n keys |
| apps/web/src/assets/i18n/en.json | Change | Add delete-related i18n keys |

## Tasks & Acceptance

- [ ] Task 1: Add delete modal signals and methods to facade
  - AC: showDeleteModal WritableSignal<boolean>, openDeleteModal(), closeDeleteModal(), confirmDeleteCourse() methods exist
- [ ] Task 2: Add Delete button to course-edit header (visible for HIDDEN/DRAFT only)
  - AC: Button with Trash2 icon appears only for HIDDEN and DRAFT statuses
- [ ] Task 3: Add confirmation modal to course-edit template
  - AC: Modal shows course title, warning text, Cancel and Delete buttons
- [ ] Task 4: Add component methods for delete flow
  - AC: onDelete opens modal, onConfirmDelete calls facade, onCancelDelete closes modal
- [ ] Task 5: Add i18n keys for both uk and en
  - AC: All new strings use transloco keys
- [ ] Task 6: Navigate to course list after successful delete
  - AC: After delete, user lands on /staff/courses

## Code Review Checklist

- [x] Код відповідає архітектурі проекту
- [x] Немає хардкоду (конфіг винесено)
- [x] Обробка помилок
- [x] Безпека (OWASP)
- [x] Типи (TypeScript strict)

## Оновлення документації

- [x] API docs оновлено — N/A (endpoint exists)
- [x] Architecture doc оновлено — N/A
- [x] README оновлено — N/A
