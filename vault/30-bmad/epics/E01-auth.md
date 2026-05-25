---
title: "E01 — Auth & Identity"
type: epic
status: draft
epic-id: E01
created: 2026-05-24
prd-refs: AUTH-1, AUTH-2, AUTH-3, AUTH-4, AUTH-4a, AUTH-4b, AUTH-4c, AUTH-4d, AUTH-4e, AUTH-5, AUTH-6, AUTH-7, AUTH-8, AUTH-8a, AUTH-9
---

# E01 — Auth & Identity

## Мета

Забезпечити безпечну автентифікацію та авторизацію для всіх категорій користувачів платформи: Person (OAuth через Google, Facebook, Telegram) та Staff (email + пароль + MFA), з єдиним акаунтом незалежно від способу входу.

## Scope

### Включено

- JWT access + refresh токени з rotation та family tracking (AUTH-1, AUTH-8)
- 5 ролей (Person, Consultant, Supervisor, Coordinator, Admin) з NestJS Guards (AUTH-2, AUTH-3)
- OAuth flow для Person: Google, Facebook, Telegram Login Widget (AUTH-4, AUTH-4a, AUTH-4b)
- Implicit registration при першому вході та при відправці анкети (AUTH-4c, AUTH-4e)
- Зв'язування кількох провайдерів в один акаунт (AUTH-4d)
- Invite-based реєстрація Staff з одноразовим токеном (72 год) (AUTH-5)
- Єдиний профіль Person незалежно від провайдера входу (AUTH-6)
- Два чекбокси GDPR-згоди (загальна + Art.9) з timestamp (AUTH-7)
- Silent token refresh під час upload (AUTH-8a)
- MFA для Staff, backup-коди, recovery flow, break-glass акаунт (AUTH-9)
- Crisis session exemption від forced logout (AUTH-8)

### Виключено

- UI компоненти авторизації (див. E14 Public Web, E16 UI Shell)
- GDPR export/delete потоки (див. E12 GDPR)
- Адмін-панель управління користувачами (див. E13 Admin)

## Вимоги PRD

| ID | Короткий опис | Пріоритет |
|---|---|---|
| AUTH-1 | JWT access + refresh токени | MVP |
| AUTH-2 | 5 ролей | MVP |
| AUTH-3 | Рольові Guards | MVP |
| AUTH-4..4e | OAuth провайдери + implicit registration | MVP |
| AUTH-5 | Invite-based реєстрація Staff | MVP |
| AUTH-6 | Єдиний акаунт Person | MVP |
| AUTH-7 | GDPR-згоди (два чекбокси) | MVP |
| AUTH-8, 8a | Token rotation, family revocation, silent refresh | MVP |
| AUTH-9 | MFA, backup-коди, break-glass | MVP |

## Критерії приймання

1. Person може увійти через Google, Facebook або Telegram і отримати JWT
2. При першому вході автоматично створюється акаунт Person
3. Person може зв'язати кілька провайдерів в один акаунт; відв'язати останній неможливо
4. Staff входить через email + пароль; реєстрація тільки через invite-link
5. Guards блокують доступ до ендпоінтів за роллю (401/403)
6. Refresh token rotation працює; replay attack викликає revocation всієї family
7. MFA активується для Staff; backup-коди дозволяють відновлення
8. GDPR-згоди зберігаються з timestamps; без згоди кейс не створюється
9. Crisis session не переривається forced logout протягом 24 годин

## Залежності

- **E17 Infrastructure** -- NestJS, PostgreSQL, Redis (передумова)
- **E12 GDPR** -- споживає AUTH-7 consent timestamps
- **E02 Cases** -- потребує авторизованого користувача для створення кейсу

## Поза scope

- Адмін CRUD користувачів (E13)
- Деактивація/видалення акаунту (E12)
- Landing page та модальне вікно авторизації (E14)
