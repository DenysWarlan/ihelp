---
title: "Epic Map — Є турбота"
type: planning
status: draft
created: 2026-05-24
author: Analyst
---

# Epic Map — "Є турбота" Care Coordination Platform

> Верхньорівнева карта епіків з 1–2 реченнями опису. Stories будуть деталізовані після погодження з менеджером.

## Фаза: MVP

### E01 — Auth & Identity

Реєстрація/вхід Person через OAuth (Google, Facebook, Telegram), вхід Staff через email+пароль+MFA, 5 ролей з Guards, refresh token rotation з family tracking, зв'язування кількох провайдерів в один акаунт, invite-based реєстрація Staff.

**Вимоги PRD:** AUTH-1..9, EDGE-1..5

---

### E02 — Care Cases

Життєвий цикл кейсу (new → assigned → in_progress → ... → closed), state machine з валідацією переходів, приватні нотатки консультанта, audit log дій, зв'язок з курсом, optimistic locking, автоматична пауза при неактивності.

**Вимоги PRD:** CASE-1..10, EDGE-10..25

---

### E03 — Omnichannel Chat

Веб-чат на Socket.io, інтеграція Telegram Bot API, Unified Message Bus, єдина модель повідомлення з каналом, вкладення до 10 МБ, timestamp-based ordering, збереження видалених/відредагованих повідомлень, індикатор каналу, fallback chain при недоступності каналу.

**Вимоги PRD:** CHAT-1..7, CHAT-14..16, EDGE-20..22

---

### E04 — LMS (Courses)

Структура курсу (Course → Lesson), типи контенту (text/video/mixed), каталог і preview (публічний), enrollment, progress tracking з progress bar, trigger warnings на уроках, кнопка "Мені важко" з інтеграцією в кейси, імпорт/експорт курсів у JSON, CRUD курсів і уроків в Admin, скидання прогресу.

**Вимоги PRD:** LMS-1..7, EDGE-40..44
**Деталі:** [business-analysis-lms.md](analysis/business-analysis-lms.md)

---

### E05 — Video Meetings

Створення зустрічі з картки кейсу, генерування посилання Zoom/Google Meet з retry, нагадування (за 1 год, за 15 хв), відображення в кабінеті Person і консультанта, валідація timezone і overlap.

**Вимоги PRD:** MEET-1..4

---

### E06 — Auto-Assignment Engine

Алгоритм авторозподілу (спеціалізація → мова → доступність → навантаження), atomic decrement слотів з CHECK constraint, fallback на координатора, перевірка статусу консультанта, чергування нових кейсів з SLA таймером і повідомленням Person.

**Вимоги PRD:** ASSIGN-1..3, ASSIGN-6

---

### E07 — SLA Monitor

Трекінг часу до першої відповіді, ескалаційні рівні (4ч → 12ч → 24ч → 48ч), push/email/SMS ескалації, пауза/перезапуск таймера, distributed lock на SLA record, дашборд SLA для координатора.

**Вимоги PRD:** SLA-1..3, SLA-5..6

---

### E08 — Crisis Protocol

Keyword scanning повідомлень Person (uk/ru), рівні ризику (високий/середній/низький), миттєва ескалація при високому ризику (SMS → push → email → phone call), автовідповідь з контактами екстреної лінії, конфігурований список ключових слів, нічне чергування, логування спрацювань.

**Вимоги PRD:** CRISIS-1..7, EDGE-30..35

---

### E09 — Workload & Burnout Protection

Конфігурований ліміт кейсів/консультант (default 10), ліміт кризових кейсів (default 3), візуалізація навантаження (progress bar), ескалація при переповненні, детекція forced logout координатора при кризовій ескалації.

**Вимоги PRD:** BURN-1..3

---

### E10 — Case Transfer

"Я йду у відпустку" / "Я йду назавжди", автопідбір заміни за спеціалізацією, перепланування зустрічей при transfer, повідомлення Person, передача історії, блокування видалення при активних кейсах, блокування звільнення при кризових кейсах.

**Вимоги PRD:** TRANSFER-1..4, TRANSFER-6

---

### E11 — Quality Control & Analytics

Метрики по консультантах (час відповіді, завершені кейси), загальна аналітика (звернення, кейси, конверсії, курси), дашборд координатора, звіт якості для супервізора.

**Вимоги PRD:** QC-1..2

---

### E12 — GDPR & Privacy

Два чекбокси згоди (загальна + Art.9), право на видалення (30 днів, каскадне), право на експорт (Art.20 ZIP), SAR маршрутизація, watermarking, PII фільтрація в нотатках, retention policy, блокування видалення при кризовому кейсі.

**Вимоги PRD:** AUTH-7, GDPR-related з 5.2, EDGE-60..65

---

### E13 — Admin Panel

Управління користувачами (CRUD, invite, деактивація), управління курсами (delegate до E04), налаштування системи (SLA пороги, ліміти, кризові keywords), чергування кризової лінії, аудит-лог, виявлення дублікатів акаунтів.

**Вимоги PRD:** A-1..4

---

### E14 — Public Web (Landing + Intake)

Landing page, каталог курсів (публічний), preview курсу, модальне вікно авторизації, форма звернення (анкета), підтвердження "Звернення надіслано", OAuth flow з rollback згоди при помилці.

**Вимоги PRD:** P-1..2, LMS-6

---

### E15 — Person Cabinet

Кабінет Person: призначений консультант, заплановані зустрічі, рекомендовані курси з прогресом, чат, налаштування профілю (timezone, linked accounts), GDPR-дії (export, delete, consent withdrawal).

**Вимоги PRD:** P-3..5

---

### E16 — UI Shell & Design System

Sidebar навігація по ролях, responsive layout, design tokens ($accent, $bg, $surface...), типографіка (Inter, Geist Mono), компоненти: badge, progress bar, alert banner, table, card, form inputs. Lucide icons.

**Джерело:** Design System frame у ihelp-design.pen

---

### E17 — Infrastructure & DevOps

NestJS backend, Angular frontend, PostgreSQL + Prisma, Redis (Bull queues, Socket.io adapter), S3 (MinIO dev), Docker Compose dev, CI/CD pipeline, Nginx reverse proxy, TLS, environment configs.

**Джерело:** architecture.md ADR-001..003

---

## Фаза: v1.1

| Епік | Опис |
|------|------|
| E03+ Chat Channels | Viber Bot API, channel switching, "typing" indicator |
| E04+ LMS Recommendations | Рекомендація курсу консультантом з правом відмови Person |
| E06+ Smart Assignment | Timezone консультанта, логування причин, календар доступності |
| E07+ SLA Extended | Трекінг між повідомленнями, ескалація >48ч/5д/7д |
| E08+ Crisis Extended | Мультимовні keywords (EN, AR), speech-to-text для voice notes |
| E09+ Burnout Alerts | Алерт при 3+ кризових/тиждень, детекція неактивності |
| E10+ Transfer Extended | Координатор ініціює transfer, ASSIGN-5 timezone |
| E11+ Analytics Extended | Щотижневий автозвіт, форма відгуку Person, аналітика по темах |
| E13+ Onboarding | Обмежені права для новачків, наставник з read-only доступом |

## Фаза: v1.2+

| Епік | Опис |
|------|------|
| E03++ More Channels | Instagram Messaging, Facebook Messenger, delivery statuses |
| E04++ LMS Quizzes | Тести/запитання після уроків |
| E04+++ LMS Certificates | Сертифікат про проходження (v2.0) |
| E09++ Burnout Detection | Детекція зростання часу відповіді (3x за 2 тижні) |
| E11++ Advanced Analytics | Bottleneck-аналіз, піковий час, прогресивне збільшення лімітів |
| E13++ Onboarding Bot | Тестовий кейс: бот-симулятор для тренування |

---

## Залежності між епіками (MVP)

```
E17 Infrastructure ─┐
E16 UI Shell ───────┤
E01 Auth ───────────┼──→ E14 Public Web
                    │      ↓
                    ├──→ E02 Cases ──→ E06 Assignment
                    │      ↓              ↓
                    ├──→ E03 Chat    E07 SLA Monitor
                    │      ↓              ↓
                    ├──→ E08 Crisis  E09 Workload
                    │                     ↓
                    ├──→ E04 LMS    E10 Transfer
                    │
                    ├──→ E05 Meetings
                    │
                    ├──→ E15 Person Cabinet
                    │
                    ├──→ E12 GDPR
                    │
                    └──→ E13 Admin
                           ↓
                      E11 Analytics
```

**Критичний шлях:** E17 → E01 → E02 → E03 → E06 → E07 → E08
