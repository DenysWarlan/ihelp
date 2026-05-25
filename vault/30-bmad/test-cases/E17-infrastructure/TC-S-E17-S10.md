---
epic: E17
story: S-E17-10
title: "Тест-кейси: Rate Limiting та безпека"
---

# Тест-кейси: S-E17-10 — Rate Limiting та безпека

## Контекст
Ця сторія реалізує rate limiting на auth та глобальних endpoints, Helmet middleware для HTTP security headers та CORS-конфігурацію. Тести перевіряють обмеження запитів на auth endpoints (5 за 15 хвилин), наявність security headers, CORS-фільтрацію за origin та глобальний rate limit.

### TC-S-E17-S10-01: Rate limiting на auth endpoints
- **Передумови:** Backend запущений; rate limiting налаштований
- **Кроки:**
  1. Відправити 5 запитів на auth endpoint протягом 15 хвилин
  2. Відправити 6-й запит
- **Очікуваний результат:** Перші 5 запитів виконуються; 6-й повертає 429 Too Many Requests
- **Пріоритет:** Високий

### TC-S-E17-S10-02: Helmet middleware та CORS
- **Передумови:** Backend запущений
- **Кроки:**
  1. Перевірити HTTP security headers (X-Content-Type-Options, X-Frame-Options тощо)
  2. Відправити запит з недозволеного origin
  3. Відправити запит з дозволеного origin
- **Очікуваний результат:** Security headers присутні (Helmet); недозволений origin — CORS-помилка; дозволений origin — запит проходить
- **Пріоритет:** Високий

### TC-S-E17-S10-03: Глобальний rate limit
- **Передумови:** Backend з глобальним rate limit
- **Кроки:**
  1. Відправити велику кількість запитів на звичайний ендпоінт за короткий час
- **Очікуваний результат:** Після перевищення глобального ліміту — відповідь 429 Too Many Requests
- **Пріоритет:** Середній
