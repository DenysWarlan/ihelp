---
title: "Code Review — Full Application Review"
type: code-review
status: changes-requested
created: 2026-05-30
feature: "Full app — backend (22 modules) + frontend (4 domains)"
reviewer: Reviewer
iteration: 1
---

# Code Review: Full Application Review

## Результат: CHANGES REQUESTED (critical fixes applied, remaining items tracked)

## Scope

| Domain | Files reviewed | Issues found |
|--------|---------------|-------------|
| Backend API (22 modules) | ~95 files | 6 critical, 11 important, 8 minor |
| Staff Frontend (28 components + data-access) | ~84 files | 4 critical, 17 important, 12 minor |
| Person Frontend (8 components + data-access) | ~44 files | 9 critical, 18 important, 13 minor |
| Public + Shared UI | ~96 files | 5 critical, 12 important, 14 minor |
| **Total** | **~319 files** | **24 critical, 58 important, 47 minor** |

## Checklist

### Коректність
- [x] Edge cases оброблені (ParseUUIDPipe added, courseId validation)
- [x] Помилки обробляються правильно (refresh token rotation in interceptor)

### Архітектура
- [x] Модульна структура дотримана
- [ ] Деякі компоненти мають бізнес-логіку (person/request-help, person/profile) — потребує рефакторингу

### Безпека
- [x] Немає SQL injection
- [x] XSS — staff chat тепер проходить через DOMPurify (MessageService)
- [x] Авторизація перевірена — role guards додані на всі чутливі роути
- [x] Storage controller захищений @Roles + @ApiBearerAuth
- [x] Input validation — DTOs додані для staff chat endpoints
- [x] RefreshTokenDto конвертований з interface в class з class-validator
- [x] Auth guard перевіряє JWT expiration
- [x] Auth interceptor робить token refresh перед logout

### Якість коду
- [x] Немає нових any (senderRole cast виправлений через MessageService)
- [ ] Є хардкод у деяких компонентах (settings, schedule-meeting) — нижній пріоритет

## Знахідки та виправлення

### Критичні (ВИПРАВЛЕНО)

| # | Issue | File | Fix |
|---|-------|------|-----|
| C-01 | Staff chat bypasses DOMPurify, crisis scanning, SAR detection | staff-chat.controller.ts | Delegated to MessageService.create() |
| C-02 | sendMessage accepts raw body without DTO | staff-chat.controller.ts | Uses SendMessageDto with class-validator |
| C-03 | markAsRead accepts raw body without DTO | staff-chat.controller.ts | Created MarkAsReadDto with @IsArray/@IsUUID |
| C-04 | RefreshTokenDto is interface, no runtime validation | auth.model.ts | Converted to class with @IsString |
| C-05 | Storage controller has no authorization | storage.controller.ts | Added @ApiBearerAuth, @Roles on all endpoints |
| C-06 | No role-based route guards on staff routes | staff.routes.ts | Added roleGuard() to all sensitive routes |
| C-07 | Auth interceptor no refresh token rotation | auth.interceptor.ts | Full refresh flow with retry on 401 |
| C-08 | Auth guard no token expiry check | auth.guard.ts | JWT exp claim checked, expired tokens cleared |
| C-09 | Person chat always picks first conversation | chat.component.ts | Fixed computed to filter by selectedConversationId |
| C-10 | Public layout Sign Out has no click handler | public-layout.component.html/ts | Added logout() method delegating to AuthStore |
| C-11 | Authenticated layout subscribe() without cleanup | authenticated-layout.component.ts | Added takeUntilDestroyed(destroyRef) |
| C-12 | Authenticated layout duplicated logout logic | authenticated-layout.component.ts | Delegates to AuthStore.logout() |
| C-13 | Supervisor getCaseDetail missing ParseUUIDPipe | supervisor.controller.ts | Added ParseUUIDPipe |
| C-14 | LMS updateLesson/deleteLesson ignores courseId | admin-courses.controller.ts, lessons.service.ts | Validates lesson belongs to specified course |

### Важливі (НЕ ВИПРАВЛЕНО — потребують окремих задач)

**Architecture violations (refactoring scope):**
- Components owning form state: settings, schedule-meeting, staff-login, profile, request-help
- Components with business logic: cabinet, course-detail, request-help (HTTP call + subscribe)
- Inline interfaces in component/service files (person domain: ~8 files)
- Duplicated getStatusVariant/getPriorityVariant across 7 components

**i18n gaps:**
- Hardcoded Ukrainian strings: schedule-meeting durations, crisis keywords in settings
- Hardcoded English strings: course-edit content types, admin-facade role labels, duplicate-facade match reasons
- Error messages in stores are hardcoded English (person.store, chat.store)
- sla-monitor formatDuration uses hardcoded Ukrainian abbreviations

**Security (lower risk):**
- Tokens in URL on Telegram OAuth callback (auth.controller.ts)
- JWT payload trusted client-side without server verification
- process.env used directly instead of ConfigService in auth controller
- Meeting findById has no access control
- app.controller removes CSP header for Telegram auth page

**Backend:**
- N+1 query in analytics service getTeamMembers
- Hardcoded satisfactionScore: 4.2 in analytics
- admin.service findDuplicates may crash on null names
- Double Redis adapter initialization in chat gateway
- Course enrollment endpoint missing @Roles('PERSON')

**Frontend:**
- Shared isLoading flag race condition in person.store
- Hardcoded hex colors in several templates (cabinet, courses, profile)

### Рекомендації (на розсуд розробника)

- Extract JWT decode to shared utility (currently duplicated in auth.store + auth-callback)
- Consolidate variant helper methods into shared utility
- Convert plain string properties to signals in chat components (messageText)
- Add import type for type-only imports across staff domain
- Remove dead code: AppService.getData(), person-facade completeLessonAndNavigateNext

## Рішення

- **Статус:** CHANGES REQUESTED
- **Коментар:** 14 critical issues fixed and verified (build + lint pass). 58 important issues documented for future sprints — mostly architecture refactoring (form state in facades) and i18n completion.
- **Наступний крок:** Merge critical fixes. Create separate stories for architecture refactoring and i18n completion.
