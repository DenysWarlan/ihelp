---
title: "Admin Course & Lesson Preview"
type: feature-spec
status: in-progress
created: 2026-06-07
epic: "vault/30-bmad/epics/E04-lms.md"
story: "vault/30-bmad/stories/E04-lms/S-E04-14.md"
author: Dev
baseline_commit: 1294b4a
context:
  - "vault/30-bmad/prd.md"
  - "vault/30-bmad/architecture/architecture.md"
---

# Фіча: Admin Course & Lesson Preview

## Контекст

S-E04-14: Admins can't see how courses look to students without publishing. Need preview for full course page and individual lessons.

## Задача

1. New route `/staff/courses/:id/preview` with CoursePreviewStaffComponent showing student view
2. Preview button (Eye) in course-edit header
3. Lesson preview modal in course-edit (Eye button per lesson row)
4. Extract YouTube ID utility to shared

## Технічний план

### Файли для створення/зміни

| Файл | Дія | Опис |
|---|---|---|
| libs/staff/components/course-preview-staff/course-preview-staff.component.ts | Create | Course preview page |
| libs/staff/components/course-preview-staff/course-preview-staff.component.html | Create | Course preview template |
| libs/staff/components/course-preview-staff/course-preview-staff.component.scss | Create | Course preview styles |
| libs/staff/components/staff.routes.ts | Change | Add preview route |
| libs/staff/components/course-edit/course-edit.component.html | Change | Add preview button + lesson preview modal |
| libs/staff/components/course-edit/course-edit.component.ts | Change | Add preview methods |
| libs/staff/components/course-edit/course-edit.component.scss | Change | Add preview modal styles |
| libs/staff/data-access/service/course-manage-facade.service.ts | Change | Add preview navigation + lesson preview signals |
| apps/web/src/assets/i18n/uk.json | Change | Add preview i18n keys |
| apps/web/src/assets/i18n/en.json | Change | Add preview i18n keys |

## Tasks & Acceptance

- [ ] Task 1: Add preview route and CoursePreviewStaffComponent
- [ ] Task 2: Add Preview button to course-edit header
- [ ] Task 3: Add lesson preview modal with Eye button per lesson row
- [ ] Task 4: Add i18n keys
- [ ] Task 5: Build passes

## Code Review Checklist

- [ ] Код відповідає архітектурі проекту
- [ ] Немає хардкоду
- [ ] Типи (TypeScript strict)

## Оновлення документації

- [ ] N/A — no new endpoints, no architecture changes
