---
title: "<назва фічі>"
type: feature-spec
status: draft | approved | in-progress | in-review | complete
created: <YYYY-MM-DD>
epic: "<шлях до епіку>"
story: "<шлях до story>"
author: Dev
baseline_commit: <commit hash або NO_VCS>
context:
  - "<шлях до PRD>"
  - "<шлях до архітектури>"
---

# Фіча: <назва>

## Контекст

<Посилання на story, epic, PRD секцію>

## Задача

<Що саме потрібно зробити>

## Технічний план

### Файли для створення/зміни

| Файл | Дія | Опис |
|---|---|---|

### Схема БД (якщо змінюється)

### API ендпоінти (якщо нові)

### UI компоненти (якщо є)

## Tasks & Acceptance

- [ ] Task 1: <опис>
  - AC: <acceptance criteria>
- [ ] Task 2: <опис>
  - AC: <acceptance criteria>

## Тестування

### Unit тести
### Integration тести
### E2E тести (якщо web)

## Code Review Checklist

- [ ] Код відповідає архітектурі проекту
- [ ] Немає хардкоду (конфіг винесено)
- [ ] Обробка помилок
- [ ] Безпека (OWASP)
- [ ] Типи (TypeScript strict)
- [ ] Тести написані та проходять

## Оновлення документації

- [ ] API docs оновлено (якщо нові ендпоінти)
- [ ] Architecture doc оновлено (якщо архітектурні зміни)
- [ ] README оновлено (якщо нові залежності/команди)
- [ ] Changelog запис додано
