---
title: "Gap-аналіз: 76 пунктів консолідованого списку"
type: analysis
status: complete
created: 2026-06-02
author: Analyst
---

# Gap-аналіз: 76 пунктів консолідованого списку

## 1. Контекст і мета

- **Що досліджуємо:** Відповідність поточної реалізації ihelp вимогам з консолідованого списку 76 пунктів
- **Чому зараз:** Продукт на стадії MVP (~85% готовності), потрібно закрити gap'и перед релізом
- **Очікуваний результат:** Пріоритизований план реалізації з чіткими задачами

## 2. Зведена таблиця по блоках

| # | Блок | Статус | Оцінка зусиль | Пріоритет |
|---|------|--------|---------------|-----------|
| 1 | Запис на консультацію | 70% — UX gap | S | P1 |
| 2 | Адміністратор — справи | 40% — немає списку справ | M | P1 |
| 3 | Супервізор | 60% — немає профілю консультанта | M | P1 |
| 4 | Координатор/призначення | 85% — UI є, потребує доопрацювання | S | P0 |
| 5 | Розподіл клієнтів | 50% — backend є, frontend gap | M | P1 |
| 6 | Ведення кейсів | 70% — базове є, потрібен прогрес | M | P1 |
| 7 | Зустрічі | 80% — кнопка є, UX gap | S | P2 |
| 8 | Контроль прогресу | 30% — мінімальна реалізація | L | P1 |
| 9 | Чати | 80% — два чати, потрібна синхронізація | M | P2 |
| 10 | Курси для консультантів | 10% — немає доступу | M | P2 |
| 11 | Курси для підопічних | 80% — кнопки є, потрібна логіка | S | P2 |

**Легенда:** S = Small (1-2 дні), M = Medium (3-5 днів), L = Large (5+ днів)

## 3. Детальний аналіз по блоках

### Блок 1: Запис на консультацію (Person flow)

**Поточний стан:**
- Кнопка "Почати спілкування" в `cabinet.component.html` — завжди видима
- При кліку відбувається навігація: якщо є консультант → `/person/chat`, інакше → `/person/request-help`
- Після відправки форми request-help показується success-екран з кнопками "Browse Courses" та "Back"

**Gap'и:**
1. **Кнопка "Почати спілкування" не змінює стан після натискання** — немає повідомлення "Зачекайте, ваш консультант скоро зв'яжеться"
2. При поверненні на cabinet кнопка знову видима навіть якщо заявка вже подана

**Рішення:**
- Після створення кейсу (status = NEW) кабінет повинен показувати стан "Очікування" замість кнопки
- PersonFacade вже має `dashboard()` сигнал — потрібно додати поле `hasPendingCase`
- Backend: `person-cabinet.service` повинен повертати наявність активного кейсу без консультанта

**Файли для зміни:**
- `libs/person/components/cabinet/cabinet.component.html` — conditional rendering
- `libs/person/data-access/service/person-facade.service.ts` — додати hasPendingCase
- `apps/api/src/person-cabinet/` — додати поле в dashboard response

---

### Блок 2: Адміністратор — всі активні справи

**Поточний стан:**
- Admin dashboard показує лише **кількість** активних справ (число)
- Немає окремого списку справ
- Немає можливості бачити хто очікує, хто отримав консультацію

**Gap'и:**
1. **Немає сторінки "Всі справи" для адміністратора**
2. Немає фільтрації по статусу (очікує/в роботі/завершено)
3. Backend: `/admin/dashboard` повертає лише count, немає list endpoint

**Рішення:**
- Створити компонент `admin-cases` зі списком всіх справ
- Backend: додати `GET /admin/cases` endpoint з фільтрацією по статусу
- Або перевикористати `GET /supervisor/cases` з admin-level доступом

**Файли для створення/зміни:**
- `libs/staff/components/admin-cases/` — новий компонент
- `apps/api/src/admin/admin.controller.ts` — новий endpoint
- `apps/api/src/admin/admin.service.ts` — метод getAllCases
- `libs/staff/data-access/service/admin-facade.service.ts` — додати метод

---

### Блок 3: Супервізор — профіль консультанта

**Поточний стан:**
- Сторінка `/staff/team` показує картки команди: ім'я, email, роль, кількість справ, resolved, avg response
- Картки **не клікабельні** — немає переходу до профілю
- SupervisorFacadeService **не має** `loadConsultantDetail()`
- Supervisor case detail **показує чат** між консультантом і клієнтом (read-only) + можливість коментувати

**Gap'и:**
1. **Немає профілю консультанта** з деталями (спеціалізації, мови, справи)
2. **Немає списку справ консультанта** (активні/завершені)
3. TeamMember model не має полів specializations, languages
4. Чат доступний через supervisor-case-detail — працює коректно

**Рішення:**
- Зробити картки команди клікабельними → відкривати профіль
- Створити `consultant-profile` компонент або модальне вікно
- Backend: `/supervisor/team/{userId}` — деталі з кейсами
- Перевикористати CoordinatorFacade.loadConsultantCases() для supervisor

**Файли для створення/зміни:**
- `libs/staff/components/consultant-profile/` — новий компонент
- `libs/staff/components/team/team.component.html` — зробити clickable
- `libs/staff/data-access/service/supervisor-facade.service.ts` — додати loadConsultantDetail
- `libs/staff/data-access/model/supervisor.model.ts` — розширити TeamMember
- `apps/api/src/supervisor/supervisor.service.ts` — додати getTeamMemberDetail

---

### Блок 4: Координатор та призначення кейсів

**Поточний стан:**
- Assignment component **повністю реалізований**: список непризначених справ, рекомендований консультант, кнопки Confirm/Other/Reject
- Modal для вибору іншого консультанта **працює**: показує всіх консультантів з workload
- Backend endpoints є: `/cases/{id}/manual-assign`, `/cases/{id}/reassign`, `/cases/{id}/auto-assign`
- Coordinator dashboard показує: unassigned cases, active cases, SLA breaches, crisis cases

**Gap'и:**
1. **Логіка незрозуміла для користувача** — потрібна документація/onboarding UX
2. Auto-assign **НЕ тригериться** при створенні кейсу — потрібен ручний запуск
3. Перепризначення доступне в API але **UI для reassign з case-detail відсутній**

**Рішення:**
- Додати інструкцію/tooltip для координатора що таке призначення
- Вирішити: тригерити auto-assign при створенні чи залишити ручне (відповідно до Блоку 5)
- Додати кнопку "Reassign" в case-detail для coordinator/admin

**Файли для зміни:**
- `libs/staff/components/case-detail/case-detail.component.html` — кнопка reassign
- `libs/staff/data-access/service/staff-facade.service.ts` — reassign method
- i18n файли — tooltips та інструкції

---

### Блок 5: Розподіл клієнтів — ручний замість автоматичного

**Поточний стан:**
- Auto-assign алгоритм існує (specialization +3, language +2, availability +1)
- Manual assign endpoint існує
- Auto-assign **НЕ тригериться** при створенні кейсу (вже ручний процес де-факто)
- Координатор вже може призначати через assignment component

**Gap'и:**
1. Потрібно **формалізувати** що розподіл завжди ручний (координатор/супервізор)
2. При призначенні показувати: компетенції, стать, спеціалізацію
3. Стать консультанта **не в моделі** — ConsultantProfile не має поля gender

**Рішення:**
- ADR: ручний розподіл як основний mode (auto-assign як recommendation)
- Додати поле `gender` до ConsultantProfile (Prisma migration)
- Показувати specializations + gender в assignment modal
- Дозволити supervisor також призначати (додати роль в guards)

**Файли для зміни:**
- `libs/prisma-client/prisma/schema.prisma` — додати gender
- Prisma migration
- Assignment modal — показувати додаткову інформацію
- Backend guards — дозволити SUPERVISOR призначення

---

### Блок 6: Ведення кейсів

**Поточний стан:**
- CareCase.consultantId є в моделі — відповідальний консультант зберігається
- Case-detail показує consultant name в sidebar
- Reassign endpoint існує
- Список справ консультанта є в cases-list

**Gap'и:**
1. **Перегляд відповідального** — є в case-detail sidebar
2. **Перепризначення** — endpoint є, UI для нього відсутній в case-detail
3. В цілому — перетинається з Блоками 4 та 5

**Рішення:** Покривається в рамках Блоків 4, 5, 8.

---

### Блок 7: Зустрічі консультанта

**Поточний стан:**
- `POST /meetings` endpoint **працює** (валідація, overlap check, Bull jobs)
- Schedule-meeting form реалізований (date, time, duration, platform, notes)
- Meetings list показує зустрічі з badge статусу
- **При відсутності зустрічей** показується лише текст "Немає зустрічей"
- **"Створити зустріч"** — кнопка є на schedule-meeting формі, але доступ до неї тільки через case-detail sidebar

**Gap'и:**
1. **При відсутності зустрічей — немає CTA кнопки** "Запланувати зустріч"
2. Кнопка "Створити зустріч" в case-detail — перевірити навігацію (routing)

**Рішення:**
- Додати кнопку "Запланувати зустріч" в empty state зустрічей
- Перевірити routing до schedule-meeting (потрібен caseId)

**Файли для зміни:**
- `libs/staff/components/meetings/meetings.component.html` — CTA в empty state
- Routing — визначити як обрати case для зустрічі з meetings page

---

### Блок 8: Контроль прогресу справи

**Поточний стан:**
- Case-detail показує: chat, notes, status, priority, SLA deadline
- **Немає**: кількості зустрічей, запланованих зустрічей, прогресу
- **Немає кнопки "Завершити кейс"**
- Статуси: NEW, ASSIGNED, IN_PROGRESS, MEETING_SCHEDULED, ON_HOLD, TRANSFERRED, COMPLETED, CLOSED

**Gap'и:**
1. **Прогрес-секція**: meetings count, notes count, history timeline
2. **Кнопка "Завершити кейс"** з підтвердженням + збір feedback
3. **Статуси не відповідають запиту** — потрібні: "Очікує призначення", "Активний супровід", "Очікує завершення"
4. **Feedback endpoint** — model є, API endpoint відсутній
5. Audit log існує але **не відображається** в case-detail

**Рішення:**

Статуси — mapping:
| Запитаний | Поточний | Дія |
|-----------|----------|-----|
| Нова | NEW | OK |
| Очікує призначення | NEW (без consultant) | Відображати як окремий label |
| У роботі | IN_PROGRESS | OK |
| Активний супровід | MEETING_SCHEDULED | Перейменувати label |
| Очікує завершення | ON_HOLD | Перейменувати label або додати новий |
| Завершена | COMPLETED + CLOSED | OK |

Рекомендація: **НЕ змінювати enum** в Prisma (ризик міграції), а змінити **відображення** через i18n/mapping.

Case detail розширення:
- Додати progress section: meetings (completed/scheduled), notes count
- Додати кнопку "Завершити кейс" → зміна статусу на COMPLETED
- Перед завершенням — modal з формою feedback
- Додати timeline/history з audit log

**Файли для створення/зміни:**
- `libs/staff/components/case-detail/case-detail.component.html` — progress section + close button
- `libs/staff/components/case-detail/case-detail.component.ts` — close/feedback logic
- `libs/staff/data-access/model/staff.model.ts` — розширити CaseDetail model
- Backend: додати feedback endpoint
- Backend: включити meetings count + audit в case detail response
- i18n — mapping статусів на українську

---

### Блок 9: Чати консультанта — синхронізація

**Поточний стан:**
- **staff-chat** (`/staff/chat`): список розмов → повідомлення → інфо про кейс (3 колонки)
- **case-detail** (`/staff/cases/:id`): чат + sidebar з деталями + notes
- Обидва показують повідомлення з одного кейсу але через **різні facade/store**
- StaffChatFacade та StaffFacade — окремі сервіси з окремими HTTP запитами

**Gap'и:**
1. Повідомлення надсилаються в одну й ту саму таблицю Message (careCaseId)
2. Але **різні stores** можуть мати **різний кеш** — розсинхронізація
3. Для консультанта незрозуміло навіщо два інтерфейси

**Рішення — варіант A (рекомендований):**
- Зробити staff-chat основним місцем листування
- В case-detail показувати останні повідомлення з кнопкою "Відкрити чат"
- Чітко розділити: case-detail = управління кейсом, staff-chat = комунікація

**Рішення — варіант B:**
- Синхронізувати через єдиний ChatStore для обох компонентів
- Складніше, але повна рівнозначність обох інтерфейсів

**ADR потрібен** для вибору варіанта.

---

### Блок 10: Курси для консультантів

**Поточний стан:**
- Courses management існує для ADMIN та COORDINATOR
- Route `/staff/courses` захищений `roleGuard(ADMIN, COORDINATOR)`
- Consultant component НЕ має навігації до курсів
- Немає consultant-specific course view

**Gap'и:**
1. Консультанти **не мають доступу** до курсів
2. Концепція не визначена: навчання консультантів vs рекомендації підопічним

**Рішення:**
- Визначити концепцію (потребує product decision)
- Найпростіше: дозволити CONSULTANT read-only доступ до опублікованих курсів
- Додати navigation card в consultant dashboard
- Розширити route guard: `roleGuard(ADMIN, COORDINATOR, CONSULTANT)`

**Файли для зміни:**
- `libs/staff/components/consultant/consultant.component.html` — navigation card
- Staff routes — додати consultant course route
- Route guards — розширити доступ

---

### Блок 11: Курси для підопічних — навігація та кнопки

**Поточний стан:**
- Active courses: кнопка "Continue" (`courses.continue`)
- Recommended courses: кнопка "Start" (`courses.start`)
- Course detail: back button "Back" (`courseDetail.back`)
- Lesson detail: back button "Back to Course" (`lessonDetail.backToCourse`)
- Після завершення останнього уроку: навігація до наступного або до курсу

**Gap'и:**
1. **Немає великої кнопки "Повернутися до курсів"** після завершення курсу
2. Кнопка "Розпочати навчання" vs "Перейти до уроку" — потрібно уточнити копі

**Рішення:**
- Після завершення останнього уроку — success screen з кнопкою "Повернутися до курсів"
- В course-detail: якщо курс завершено → "Курс завершено!" + кнопка назад
- Кнопки вже відповідають прогресу (Continue vs Start) — можливо потрібно уточнити переклади

**Файли для зміни:**
- `libs/person/components/lesson-detail/lesson-detail.component.html` — success after last lesson
- `libs/person/components/course-detail/course-detail.component.html` — course completion state
- i18n файли — переклади кнопок

## 4. Пріоритизований план реалізації

### Sprint 1 (P0 + P1 критичні) — ~2 тижні

| # | Задача | Блок | Зусилля | Залежності |
|---|--------|------|---------|------------|
| 1 | Person cabinet: стан "Очікування" після подачі заявки | 1 | S | - |
| 2 | Admin: сторінка "Всі справи" | 2 | M | - |
| 3 | Supervisor: профіль консультанта з кейсами | 3 | M | - |
| 4 | Case-detail: progress section + "Завершити кейс" | 8 | L | #5 |
| 5 | Backend: feedback endpoint + розширений case detail | 8 | M | - |
| 6 | Coordinator: reassign button в case-detail | 4 | S | - |
| 7 | i18n: маппінг статусів на українську | 8 | S | - |

### Sprint 2 (P1 решта + P2) — ~2 тижні

| # | Задача | Блок | Зусилля | Залежності |
|---|--------|------|---------|------------|
| 8 | ADR: ручний розподіл як основний mode | 5 | S | - |
| 9 | ConsultantProfile: додати gender field | 5 | S | #8 |
| 10 | Assignment modal: показувати specializations + gender | 5 | S | #9 |
| 11 | Meetings: CTA в empty state | 7 | S | - |
| 12 | Chat: ADR + реалізація синхронізації | 9 | M | - |
| 13 | Courses: доступ для консультантів | 10 | M | - |
| 14 | Lesson: "Повернутися до курсів" після завершення | 11 | S | - |
| 15 | Supervisor: дозволити assignment | 5 | S | #8 |

## 5. Ризики

| Ризик | Ймовірність | Вплив | Мітигація |
|---|---|---|---|
| Зміна enum CaseStatus може зламати існуючі кейси | Високий | Критичний | НЕ міняти enum, використати i18n mapping |
| Два чати → confusion для консультантів | Середній | Середній | ADR + UX пояснення |
| Gender field — GDPR implications | Низький | Середній | Optional field, data minimization |
| Prisma migration для gender | Низький | Низький | Стандартна nullable column |

## 6. Висновки та рекомендації

### Ключові знахідки
1. Backend покриває ~90% вимог — основні gap'и на frontend
2. Coordinator assignment **вже працює** — потрібна полірока UX
3. Supervisor case-detail chat **працює** — read-only + коментарі
4. Найбільший gap — **контроль прогресу справи** (Блок 8) — потребує нових UI секцій
5. Два чати — архітектурне рішення, потребує ADR

### Рекомендований шлях
1. Почати з Sprint 1 — закрити P0/P1 gap'и
2. ADR для чатів та розподілу перед Sprint 2
3. НЕ змінювати Prisma enum CaseStatus — mapping через i18n
4. Перевикористовувати існуючі backend endpoints де можливо
