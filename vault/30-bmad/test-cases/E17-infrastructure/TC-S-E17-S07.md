---
epic: E17
story: S-E17-07
title: "Тест-кейси: Nginx Reverse Proxy"
---

# Тест-кейси: S-E17-07 — Nginx Reverse Proxy

## Контекст
Ця сторія реалізує Nginx як reverse proxy для маршрутизації між Angular frontend та NestJS backend. Тести перевіряють routing статичних файлів та API-запитів, WebSocket upgrade для Socket.io та TLS з gzip compression.

### TC-S-E17-S07-01: Routing API та frontend
- **Передумови:** Nginx, backend та frontend запущені
- **Кроки:**
  1. Відкрити `/` у браузері
  2. Відправити запит на `/api/health`
  3. Перевірити routing
- **Очікуваний результат:** `/` обслуговує Angular static файли; `/api/*` проксується на NestJS backend
- **Пріоритет:** Високий

### TC-S-E17-S07-02: WebSocket upgrade для Socket.io
- **Передумови:** Nginx та backend з Socket.io запущені
- **Кроки:**
  1. Встановити WebSocket-з'єднання через `/socket.io/`
  2. Надіслати та отримати повідомлення
- **Очікуваний результат:** WebSocket upgrade працює через Nginx; повідомлення передаються без помилок
- **Пріоритет:** Високий

### TC-S-E17-S07-03: TLS та gzip compression
- **Передумови:** Nginx налаштований з TLS (self-signed для dev)
- **Кроки:**
  1. Відкрити сайт через HTTPS
  2. Перевірити стиснення статичних файлів (Accept-Encoding: gzip)
- **Очікуваний результат:** HTTPS працює; статичні ресурси стиснуті через gzip
- **Пріоритет:** Середній
