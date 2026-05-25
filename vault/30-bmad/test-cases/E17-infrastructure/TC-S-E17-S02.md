---
epic: E17
story: S-E17-02
title: "Тест-кейси: Angular Frontend Scaffold"
---

# Тест-кейси: S-E17-02 — Angular Frontend Scaffold

## Контекст
Ця сторія реалізує базовий Angular frontend scaffold з production build, proxy config для dev-режиму та environment configs для різних середовищ. Тести перевіряють успішну production збірку, проксування API-запитів на backend та коректне використання environment-специфічних налаштувань.

### TC-S-E17-S02-01: Ініціалізація та збірка проєкту
- **Передумови:** Angular проєкт ініціалізований
- **Кроки:**
  1. Запустити `ng build --configuration=production`
  2. Перевірити вихідні файли
- **Очікуваний результат:** Production build проходить без помилок; генеруються оптимізовані файли
- **Пріоритет:** Високий

### TC-S-E17-S02-02: Proxy config для dev
- **Передумови:** Frontend та backend запущені в dev-режимі
- **Кроки:**
  1. Відкрити frontend у браузері
  2. Виконати запит до `/api/health`
- **Очікуваний результат:** Запит `/api` проксується на backend (NestJS); відповідь 200 OK
- **Пріоритет:** Середній

### TC-S-E17-S02-03: Environment configs для різних середовищ
- **Передумови:** Angular проєкт з environment файлами
- **Кроки:**
  1. Перевірити наявність environment configs: dev, staging, prod
  2. Зібрати для кожного середовища
- **Очікуваний результат:** Кожна збірка використовує відповідний API URL та налаштування
- **Пріоритет:** Середній
