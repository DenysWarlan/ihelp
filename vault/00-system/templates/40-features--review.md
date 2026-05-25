---
title: "Code Review — <назва фічі>"
type: code-review
status: approved | changes-requested | rejected
created: <YYYY-MM-DD>
feature: "<шлях до feature spec>"
reviewer: Reviewer
iteration: 1
---

# Code Review: <назва фічі>

## Результат: APPROVED | CHANGES REQUESTED | REJECTED

## Файли перевірені

| Файл | LOC змінено | Статус |
|---|---|---|

## Checklist

### Коректність
- [ ] Код виконує те, що описано в spec
- [ ] Edge cases оброблені
- [ ] Помилки обробляються правильно

### Архітектура
- [ ] Відповідає архітектурному документу
- [ ] Модульна структура дотримана
- [ ] Немає circular dependencies

### Безпека
- [ ] Немає SQL injection
- [ ] Немає XSS
- [ ] Авторизація перевірена (guards)
- [ ] Чутливі дані не логуються
- [ ] Input validation на boundary

### Якість коду
- [ ] TypeScript strict mode
- [ ] Немає any без обґрунтування
- [ ] Немає хардкоду (config винесено)
- [ ] Naming conventions дотримані
- [ ] Немає дублювання

### Тести
- [ ] Unit тести є для нової логіки
- [ ] Тести проходять
- [ ] Coverage не зменшився

### Документація
- [ ] API docs оновлені (якщо нові ендпоінти)
- [ ] JSDoc для публічних методів
- [ ] Architecture doc оновлений (якщо архітектурні зміни)

## Знахідки

### Критичні (блокують merge)

### Важливі (бажано виправити)

### Рекомендації (на розсуд розробника)

## Рішення

- **Статус:** 
- **Коментар:** 
- **Наступний крок:** merge | fix & re-review | reject
