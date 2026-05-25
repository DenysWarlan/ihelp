---
epic: E17
story: S-E17-09
title: "Тест-кейси: Structured Logging та Correlation ID"
---

# Тест-кейси: S-E17-09 — Structured Logging та Correlation ID

## Контекст
Ця сторія реалізує structured JSON logging з Correlation ID, що прокидається через усі шари додатку. Тести перевіряють формат JSON-логів (timestamp, level, correlation_id, module, message) та наскрізне використання Correlation ID з HTTP-заголовка X-Correlation-ID або автогенерованого UUID.

### TC-S-E17-S09-01: Structured JSON логи
- **Передумови:** Backend запущений
- **Кроки:**
  1. Відправити HTTP-запит на будь-який ендпоінт
  2. Перевірити формат логів
- **Очікуваний результат:** Логи у форматі JSON містять: timestamp, level, correlation_id, module, message
- **Пріоритет:** Високий

### TC-S-E17-S09-02: Correlation ID прокидується через всі шари
- **Передумови:** Backend запущений
- **Кроки:**
  1. Відправити запит з header `X-Correlation-ID: test-123`
  2. Перевірити логи middleware, service та repository
  3. Відправити запит без header
- **Очікуваний результат:** З header: `test-123` використовується у всіх логах; без header: генерується новий UUID, використовується у всіх шарах
- **Пріоритет:** Високий
