---
epic: E16
story: S-E16-01
title: "Тест-кейси: Angular App Shell"
---

# Тест-кейси: S-E16-01 — Angular App Shell

## Контекст
Ця сторія реалізує базовий Angular app shell з lazy-loaded routes для публічної, person та staff зон. Тести перевіряють lazy-loading route modules, guard для захищених маршрутів та коректне використання environment configs для різних середовищ (dev, staging, prod).

### TC-S-E16-S01-01: Ініціалізація app shell з lazy-loaded routes
- **Передумови:** Angular проєкт зібраний та запущений
- **Кроки:**
  1. Відкрити додаток у браузері
  2. Перевірити Network tab — завантаження route modules
  3. Перейти між публічною зоною, person cabinet та staff зоною
- **Очікуваний результат:** App shell рендериться; route modules завантажуються лише при переході (lazy-loaded); public, person, staff зони — окремі chunks
- **Пріоритет:** Високий

### TC-S-E16-S01-02: Guard для авторизованих маршрутів
- **Передумови:** Користувач не авторизований
- **Кроки:**
  1. Спробувати відкрити `/my` (person cabinet)
  2. Спробувати відкрити staff-маршрут
- **Очікуваний результат:** Перенаправлення на `/login` для обох маршрутів
- **Пріоритет:** Високий

### TC-S-E16-S01-03: Environment configs
- **Передумови:** Збірки для dev, staging та prod
- **Кроки:**
  1. Зібрати проєкт для dev environment
  2. Зібрати для staging
  3. Зібрати для prod
- **Очікуваний результат:** Кожна збірка використовує відповідний environment config (API URL, feature flags тощо)
- **Пріоритет:** Середній
