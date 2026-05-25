---
title: "Системний аналіз — Є турбота"
type: analysis
status: complete
created: 2026-05-24
author: Analyst
scope: system
---

# Системний аналіз — "Є турбота" Care Coordination Platform

## 1. Контекст

- **Стек:** Angular 19 + NestJS + PostgreSQL + Prisma + Socket.io + JWT
- **Архітектура:** Модульний моноліт
- **Мета документу:** Технічні ризики, edge cases, безпека даних, архітектурні рішення — для архітектора та розробника

---

## 2. Технічні ризики

| Ризик | Ймовірність | Вплив | Мітигація |
|---|---|---|---|
| WebSocket з'єднання нестабільне на мобільних | Середня | Високий | Fallback на polling, офлайн-черга повідомлень, push-сповіщення |
| Instagram/Facebook змінять API | Середня | Середній | Adapter pattern — заміна одного адаптера не зачіпає систему |
| Zoom/Google Meet API лімітований | Низька | Середній | Зберігати тільки посилання, не інтегрувати глибоко |
| Telegram Bot API блокування в деяких регіонах | Низька | Високий | VPN для сервера, fallback на Viber/веб |
| Втрата даних (збій БД) | Низька | Критичний | Автобекапи PostgreSQL, point-in-time recovery |
| Перевантаження при 1000+ одночасних WebSocket | Низька | Середній | Redis pub/sub для горизонтального масштабування |
| Prisma ORM не покриває складний запит | Низька | Низький | Raw SQL fallback в Prisma |
| Socket.io reconnection storm після відновлення сервера | Середня | Середній | Exponential backoff, jitter на клієнті, connection pooling |
| Race condition при одночасному призначенні кейсу | Середня | Середній | Оптимістичне блокування в БД (version field), або SELECT FOR UPDATE |
| Telegram webhook дублює повідомлення | Середня | Низький | Ідемпотентність по update_id. Дедуплікація на рівні Message Bus |
| Великий обсяг медіа-файлів переповнює сховище | Низька | Середній | S3/R2 для файлів, lazy loading, retention policy (видалення через 1 рік) |
| JWT token theft | Низька | Високий | Short-lived access tokens (15 хв), refresh token rotation, HttpOnly cookies |
| Prisma migrations ламають production | Низька | Критичний | Shadow database для тестування міграцій, staging environment |

---

## 3. Аналіз даних і приватності

### 3.1. Класифікація даних

| Категорія | Приклади | Рівень чутливості | Обробка |
|---|---|---|---|
| Персональні дані | Ім'я, email, телефон, місто | Середній | GDPR, згода, шифрування |
| Психологічний стан | "Тривога", "ПТСР", "депресія" | Високий | Спеціальна категорія GDPR Art.9 |
| Переписки | Розмови з консультантом | Критичний | AES-256 at rest, мінімізація доступу |
| Кризова інформація | Суїцидальні думки, насильство | Критичний | Спеціальний протокол, обмежений доступ |
| Нотатки консультанта | Приватні спостереження | Високий | Видимі тільки консультанту + супервізору |
| Відгуки | Оцінка роботи консультанта | Середній | Анонімізація |

### 3.2. Регуляторні вимоги (GDPR)

| Вимога | Реалізація |
|---|---|
| **Згода на обробку** | Два окремих чекбокси: (1) загальна згода на створення акаунту та обробку персональних даних, (2) згода на обробку чутливих даних про звернення (тема, стан) згідно Art.9 GDPR. Зберігати timestamp кожної згоди окремо: `data_consent_at`, `data_sensitive_consent_at` |
| **Right to be forgotten** | Кнопка "Видалити мої дані". Каскадне видалення: профіль, кейси, повідомлення, файли. Анонімізація для статистики |
| **Data minimization** | Не збираємо зайвого. Мінімум полів в анкеті |
| **Purpose limitation** | Дані тільки для надання допомоги, не для маркетингу |
| **Data portability** | Експорт своїх даних (JSON/PDF) |
| **Breach notification** | Механізм сповіщення протягом 72 годин (GDPR Art.33) |
| **DPO** | Для обробки спеціальних категорій може знадобитись DPO |
| **Дитячі дані** | < 16 років — додаткова згода батьків (GDPR Art.8) |
| **Legal basis** | Art.6(1)(a) consent + Art.9(2)(a) explicit consent для спеціальних категорій |
| **Часткове відкликання згоди** | Обробка часткового revoke: якщо Person відкликає згоду Art.9 але зберігає загальну — архівувати чутливі дані (тема, стан), залишити профіль. UI: окремі кнопки для кожного рівня згоди |
| **Видалення під час кризи** | Блокувати GDPR deletion під час активного кризового кейсу. Вимагати спершу закриття/resolution кризи. Показувати пояснення Person |
| **Неповнолітній досягає 16** | Cron job перевіряє `birthDate`: коли Person виповнюється 16 → тригер для збору прямої згоди замість батьківської. Оновити `consentType` |
| **Портабельність merged user** | Data export агрегує дані з усіх `ChannelIdentity` записів. JSON export включає всі канали. GDPR Art.20 compliance |
| **Видалення vs chat view** | При GDPR deletion замінити контент повідомлень на `[deleted]` у view консультанта. Cascade: Messages.content → anonymize, файли → видалити |
| **Key management для AES-256** | Визначити стратегію зберігання ключів (KMS/HashiCorp Vault), розклад ротації ключів, процедуру re-encryption |
| **Incident response runbook** | Створити процедуру: detection → containment → assessment → notification (72 год GDPR Art.33) → post-mortem |
| **DPA з hosting provider** | Обов'язковий Data Processing Agreement з хостинг-провайдером до запуску. Документувати lawful basis per Art.6/Art.9 |

### 3.3. Безпека

| Міра | Деталі | Пріоритет |
|---|---|---|
| TLS 1.3 | Весь трафік зашифрований | MVP |
| AES-256 at rest | Переписки шифруються в БД | MVP |
| JWT + refresh token rotation | Access: 15 хв, Refresh: 7 днів, rotation при кожному refresh | MVP |
| Rate limiting | Auth: 5 спроб/15 хв. API: 100 req/хв. Forms: 3 submissions/хв | MVP |
| CORS + CSP | Strict origin, no inline scripts | MVP |
| Input validation | Zod/class-validator на кожному ендпоінті | MVP |
| Audit log | Хто, коли, що змінив — для всіх дій з персональними даними | MVP |
| 2FA (TOTP) | Для Consultant, Supervisor, Coordinator, Admin | v1.1 |
| IP logging | Для виявлення підозрілої активності | MVP |
| Automated backups | Щоденні, зберігання 30 днів, тестування відновлення щомісяця | MVP |
| Secrets management | Env vars через Docker secrets або Vault, не в коді | MVP |
| Dependency scanning | npm audit в CI, Dependabot | MVP |
| 2FA для критичних ролей (MVP) | TOTP обов'язковий для Supervisor та Admin з MVP (не відкладати до v1.1) — вони мають доступ до кризових даних | MVP |
| Session invalidation при деактивації | Token blacklist або перевірка `isActive` при кожному запиті. При зміні ролі — негайна інвалідація сесії | MVP |
| Refresh token replay detection | Token family tracking: при виявленні replay — revoke всю сім'ю токенів. Лог інциденту | MVP |

---

## 4. Edge Cases та граничні сценарії

### 4.1. Вхід людини

| Edge Case | Сценарій | Технічне рішення |
|---|---|---|
| Дубль анкети | Марина заповнила анкету, не отримала відповідь, заповнила ще раз | `UNIQUE(email)` або `UNIQUE(telegramChatId)`. При конфлікті — `UPSERT`. Повернути існуючий кейс |
| Крос-канальна ідентифікація | Написала в Telegram і на сайт | Таблиця `ChannelIdentity(userId, channel, externalId)`. Зв'язування по email/phone. Merge UI для координатора |
| Анонімний Telegram | Немає ні імені, ні email | Створити User з `telegramChatId` як primary identifier. `name = "Анонім"`. Обмеження: немає email fallback |
| Мовна невідповідність | Людина пише англійською, немає англомовних консультантів | `Consultant.languages: string[]`. Фільтр при авторозподілі. Якщо порожній результат → `status: "unmatched"`, ескалація координатору |
| Неповнолітній | Вік < 16 | Поле `birthDate` (optional). Якщо вказано < 16 → `requiresParentalConsent: true`. Блокує створення кейсу до підтвердження |
| Наплив (50+ за годину) | Вірусний пост | Queue (Bull/BullMQ). Rate: max N кейсів/хвилину для авторозподілу. Решта → черга з повідомленням "Ваше звернення прийнято" |
| Дублікат через різні OAuth | Однаковий email через Google і Facebook → різні акаунти | Зв'язування акаунтів по verified email. Prompt merge при виявленні. `ChannelIdentity` linking |
| Координатор зливає різних людей | Помилковий merge двох channel identities різних осіб | Двофакторна верифікація перед merge + можливість undo протягом 24 год. Audit log |
| birthDate optional, реально < 16 | Person не вказує вік, але є неповнолітнім | Age self-declaration при intake або guardian flow. Консультант може вручну тригернути `requiresParentalConsent` |
| OAuth провайдер недоступний | Google/Facebook OAuth down | Показати retry + альтернативні провайдери. Кешувати стан форми в localStorage |
| Person відмовляє consent у модалці | Натиснув "Скасувати" або не поставив чекбокс | Graceful повернення до попереднього екрану без втрати browsing context |

### 4.2. Авторозподіл

| Edge Case | Технічне рішення |
|---|---|
| Жоден консультант не підходить (тема) | `assignmentResult: "no_match"`. Кейс → `status: "unassigned"`. Notification координатору через WebSocket + email |
| Всі на ліміті | `SELECT c FROM Consultant c WHERE c.activeCaseCount < c.caseLimit` → порожній результат. Кейс у чергу. Dashboard показує "0 доступних" |
| Race condition: два кейси → один консультант | `SELECT ... FOR UPDATE` при інкременті `activeCaseCount`. Або optimistic locking з `version` полем |
| Нічне звернення (не кризове) | `Consultant.workingHours: {start, end, timezone}`. Фільтр при авторозподілі. Fallback: затримати до робочих годин |
| Консультант відмовляється від кейсу | `CaseTransfer(reason, initiatedBy: 'consultant')`. Повернути кейс в пул. Не рахувати як SLA-порушення |
| Систематичне cherry-picking | Консультант відхиляє складні кейси багаторазово | Лічильник `declineCount` per consultant. Alert координатору після N відмов. Dashboard метрика |
| Distress з курсу без кейсу | Person натискає "Мені важко" але немає active case | Auto-create case з `source: "course_trigger"` + призначити duty consultant. Не залишати без відповіді |
| Stale case + upcoming meeting | Кейс auto-paused через 30 днів бездіяльності, але є запланована зустріч | Перевіряти `Meeting WHERE caseId AND scheduledAt > NOW()` перед auto-pause. Skip якщо є |
| Returning person, попередній consultant inactive | Person повертається, але попередній консультант у відпустці або деактивований | Перевірити availability перед пропозицією. Fallback: авторозподіл як для нового кейсу |

### 4.3. Unified Message Bus

| Edge Case | Технічне рішення |
|---|---|
| Telegram webhook дублює | Ідемпотентність: `UNIQUE(channel, externalMessageId)`. `ON CONFLICT DO NOTHING` |
| Людина видалила повідомлення в Telegram | Webhook `message_edit` / `message_delete` → позначити `deletedByAuthor: true`. Контент зберігається (безпека) |
| Бот заблокований людиною | Telegram API error 403. Позначити `ChannelIdentity.status = "blocked"`. Fallback на інші канали. Сповіщення консультанту |
| Великий файл (>10MB) | Middleware перевірка `Content-Length`. Відхилення з кодом 413. Повідомлення людині через бот/чат |
| Мережа нестабільна (клієнт) | Socket.io auto-reconnect з exponential backoff. Офлайн-черга на клієнті (IndexedDB). Синхронізація при reconnect |
| Мережа нестабільна (сервер→Telegram) | Retry queue (Bull) з exponential backoff. Max 5 спроб. Після — `deliveryStatus: "failed"`. Алерт адміну |
| Два пристрої одночасно | Socket.io rooms по `userId`. Broadcast на всі з'єднання. Read receipts — last writer wins |
| Read receipts multi-device conflict | "Last writer wins" некоректно: один пристрій прочитав, інший ні | Track per-device read status. Позначити read коли ANY device прочитав. Sync через WebSocket |
| Person редагує Telegram повідомлення | Консультант відповів на оригінал, Person змінив текст | Обробляти `edited_message` webhook. Показувати edit history, flag `isEdited`. Сповіщення консультанту |
| File size mismatch across channels | Telegram дозволяє 50MB, система обмежує 10MB | Telegram adapter: compress або reject файли > 10MB з повідомленням. Вирівняти ліміти або обробляти per-channel |

### 4.4. Кризовий протокол

| Edge Case | Технічне рішення |
|---|---|
| False positive ("вмираю від сміху") | Двоступеневий аналіз: 1) keyword match, 2) контекст (негативні слова поруч). Confidence score. При score < threshold → мітка "possible_crisis" без повної ескалації |
| Реальна криза, всі офлайн | Fallback ланцюг: WebSocket push → mobile push → SMS → повторний SMS через 15 хв. Автовідповідь людині з номерами екстрених служб |
| Хронічні кризові повідомлення | Поле `crisisCount` на кейсі. Якщо > 3 за тиждень → мітка `chronic_crisis`. Протокол: не ігнорувати, але супервізор визначає рівень реагування |
| Кризовий keyword в нотатці консультанта | Сканувати ТІЛЬКИ повідомлення від Person (sender_role = 'person'). Нотатки і повідомлення консультанта — не сканувати |
| Людина загрожує консультанту | `threatDetected` мітка. Негайне сповіщення адміну. `User.status = "blocked"`. Audit log. Можливість розблокування тільки адміном |
| Нічна криза фільтрується workingHours | Кризовий кейс вночі потрапляє у фільтр за робочим часом | Кризові кейси ОБОВ'ЯЗКОВО bypass `workingHours` filter. Окремий query для crisis assignment без time filter |
| Криза не-українською мовою | Кризові keywords тільки укр/рос, людина пише арабською/англійською | Multilingual crisis keyword lists (EN, AR, тощо). Розширювати при появі нових мов. Fallback: manual crisis flag |
| Всі crisis responders offline, SMS fails | SMS координатору не доставлено, жоден staff не отримав alert | Валідувати телефони staff періодично. Tertiary fallback: автоматичний POST до hotline API з екстреними номерами |
| Заблокований user створює новий акаунт | Загрозливий user реєструється через інший канал | Cross-reference blocked identifiers (phone, email, telegramId) при створенні нового акаунту. Alert admin |
| Supervisor без Crisis Alerts page | Тільки push-сповіщення, пропущений push = втрачений alert | Додати dedicated `/staff/supervisor/crisis` page з фільтрами, історією, статусами. Не тільки real-time push |

### 4.5. Курси / LMS

| Edge Case | Технічне рішення |
|---|---|
| Курс + кейс одночасно | `CourseEnrollment` і `CareCase` — незалежні сутності. `CareCase.courseEnrollmentId` (nullable FK) для контексту |
| Контент тригерить людину | Кнопка "Мені важко" → `POST /care-cases` з `source: "course_trigger"`, `courseId`, `lessonId`. Автоматичне призначення |
| Скинути прогрес | `CourseProgress.reset()` → зберегти попередній результат в `CourseProgressHistory`. Новий прогрес з 0 |
| Два курси одночасно | Дозволити: `CourseEnrollment` — many-to-one (User → many Enrollments). Окремий прогрес для кожного |
| Курс видалено адміном під час проходження | Soft delete: `Course.status = "archived"`. Enrolled users бачать "Курс завершено/архівовано". Прогрес зберігається |
| Курс archived, є linked active case | Курс архівовано, але enrolled user має active case з `sourceCourseId` | Notify консультанта про архівацію курсу. Оновити case context. Консультант не посилається на stale дані |

### 4.6. Зустрічі

| Edge Case | Технічне рішення |
|---|---|
| No-show (людина) | Cron job через 15 хв після запланованого часу. Якщо `meetingStatus != "started"` → `status: "no_show"`. Повідомлення консультанту |
| No-show (консультант) | Аналогічно. Ескалація координатору. Людина отримує повідомлення з пропозицією перезапису |
| Часові зони | Зберігати все в UTC. `User.timezone` для відображення. `Meeting.scheduledAt` — UTC timestamp. Конвертація на клієнті |
| "Хочу поговорити зараз" | `Consultant.availableNow: boolean` (real-time status через WebSocket). Якщо є вільний → instant meeting link. Якщо немає → найближчий слот |
| Zoom/Meet API down | Try/catch при генерації посилання. Fallback: повідомлення "Зателефонуйте за номером..." (якщо консультант дав згоду на телефон) |
| Mutual no-show (обидва) | І Person, і Consultant не з'явились | Cron обробляє dual no-show: auto-reschedule + notify coordinator. Окремий статус `mutual_no_show` |
| Instant meeting: Person goes offline | Person запросив зустріч зараз, consultant accepted, Person зник | 5-хвилинний timeout для невикористаного meeting link. Після timeout → `status: "expired"`. Notify consultant |

### 4.7. Передача та завершення кейсу

| Edge Case | Технічне рішення |
|---|---|
| Консультант видалений з активними кейсами | `beforeDelete` hook → перевірка `activeCaseCount > 0`. Якщо так — блокувати видалення або запустити масову передачу |
| Повторне звернення після завершення | `POST /care-cases` перевіряє `User.previousCases`. Якщо є → `CareCase.isReturning: true`. Пропонувати попереднього консультанта: `previousCase.consultantId` |
| GDPR видалення даних | `DELETE /users/:id/data` → каскадне видалення: Messages, Notes, Files, CourseProgress, Meetings. CareCase → анонімізувати (`personId: null`, зберегти aggregated stats). Background job, підтвердження протягом 30 днів |
| Кейс "завис" (немає активності 30+ днів) | Cron job щоденно. `SELECT cases WHERE lastActivityAt < NOW() - 30 days AND status = 'active'`. Auto-pause + повідомлення людині |
| Person Cabinet показує old consultant | Після transfer Person бачить старого консультанта в Cabinet | Push notification Person про зміну + real-time оновлення Cabinet через WebSocket. Перевірка `CareCase.consultantId` актуальності |

### 4.8. Інфраструктура та DevOps

| Edge Case | Технічне рішення |
|---|---|
| Бекап не виконався | Health check endpoint `/health/backup`. Cron з `|| notify_admin`. Моніторинг через Uptime Kuma або аналог |
| Міграція БД зламала дані | Shadow database для тестування міграцій. Staging environment. Point-in-time recovery з бекапу |
| DDoS на публічну форму | Cloudflare WAF. Rate limiting: 3 submissions/хв per IP. CAPTCHA після 3-ої спроби. Honeypot field |
| Сервер впав, WebSocket reconnection storm | Socket.io: `reconnectionDelay` з jitter. Server: graceful shutdown → Redis pub/sub → другий інстанс підхоплює |
| Диск переповнений | Моніторинг disk usage. Alert при > 80%. Retention policy для логів (30 днів). Media → S3/R2 |
| Surge queue без max wait time | "Ваше звернення прийнято" але немає SLA на час очікування в черзі | Визначити max queue wait time (напр. 24 год). Notify Person якщо перевищено. Dashboard метрика queue depth |

---

## 5. Карта сайту (Site Map)

> Виділено в окремий файл: [site-map.md](site-map.md)

---

## 6. Архітектурні альтернативи

### Сценарій A: Модульний моноліт (обраний)

```
Angular SPA --> NestJS API --> PostgreSQL
                    |
              Socket.io + Redis
                    |
              Message Bus (Bull)
```

**Плюси:** Простота, один деплой, один розробник може вести
**Мінуси:** Вертикальне масштабування
**Коли переростемо:** >1000 одночасних користувачів

### Сценарій B: Мікросервіси

```
Angular SPA --> API Gateway --> Chat Service
                            --> Case Service
                            --> Course Service
                            --> Notification Service
```

**Плюси:** Масштабування кожного сервісу окремо
**Мінуси:** Overengineering для 30 консультантів. DevOps complexity. Розподілені транзакції
**Коли потрібно:** Коли модульний моноліт не справляється (>1000 users)

### Сценарій C: BaaS (Supabase/Firebase) + Frontend

```
Angular SPA --> Supabase (Auth + DB + Realtime + Storage)
                    |
              Edge Functions (бізнес-логіка)
```

**Плюси:** Швидший старт, менше коду, realtime з коробки
**Мінуси:** Vendor lock-in, складна бізнес-логіка потребує edge functions, обмежений контроль над даними
**Коли підходить:** Для прототипу, але не для production з чутливими даними (GDPR Art.9)

### Рекомендація: **Сценарій A** — модульний моноліт на NestJS

Причини:
1. Один розробник — мінімізація operational overhead
2. NestJS modules = готова модулярність для майбутнього розділення
3. Повний контроль над даними (критично для GDPR Art.9)
4. PostgreSQL + Prisma = type-safe, надійне, масштабоване

---

## 7. Нефункціональні вимоги (технічні)

### Продуктивність

| Метрика | Цільове значення | Як вимірювати |
|---|---|---|
| Час завантаження SPA (LCP) | < 2 секунди | Lighthouse CI |
| Доставка повідомлень (Socket.io) | < 500 мс | Custom metric в Prometheus |
| Доставка через Telegram Bot API | < 2 секунди | Logging middleware |
| API response time (P95) | < 300 мс | NestJS interceptor + Prometheus |
| Одночасні WebSocket з'єднання | до 200 (запас до 500) | Socket.io adapter metrics |

### Масштабованість

| Параметр | MVP | Запас |
|---|---|---|
| Консультанти | 30 | до 100 |
| Активні кейси одночасно | 200-300 | до 1000 |
| Повідомлень на добу | ~500 | до 5000 |
| Курси | 5-10 | до 50 |
| Файлів у сховищі | ~5GB | до 50GB |

### Доступність

| Вимога | Значення |
|---|---|
| Uptime | 99.5% (~3.6 год downtime/міс) |
| Planned maintenance | 02:00-06:00 UTC+2 |
| Кризовий протокол | Окремий health check, auto-restart |
| Database recovery | Point-in-time, RPO < 1 година |
| Monitoring | Uptime Kuma + Prometheus + Grafana |

---

## 8. Технічний чеклист перед розробкою

- [ ] Хостинг обрано (VPS/Cloud, регіон ЄС для GDPR)
- [ ] Docker Compose для local dev
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging environment
- [ ] Backup strategy (automated daily + tested monthly)
- [ ] Monitoring stack (Uptime Kuma + Prometheus)
- [ ] Secrets management (Docker secrets або .env з .gitignore)
- [ ] Telegram Bot створено (@YeTurbotaBot)
- [ ] Zoom або Google Meet API ключі
- [ ] S3/R2 bucket для медіа-файлів
- [ ] Domain + SSL certificate
- [ ] GDPR: privacy policy draft
- [ ] GDPR: data processing agreement draft
- [ ] Crisis keywords list (затверджено супервізором)
