---
epic: E16
story: S-E16-10
title: "Тест-кейси: Layout Grid та responsive breakpoints"
---

# Тест-кейси: S-E16-10 — Layout Grid та responsive breakpoints

## Контекст
Ця сторія реалізує 12-column grid layout з responsive breakpoints та SCSS mixins. Тести перевіряють адаптацію grid під різні розміри екрану, коректність SCSS mixins та відповідність стандартам WCAG 2.1 AA щодо контрасту та focus states.

### TC-S-E16-S10-01: 12-column grid та breakpoints
- **Передумови:** Layout grid реалізований
- **Кроки:**
  1. Створити layout з 12-column grid
  2. Перевірити на mobile (< 768px), tablet (768–1024px), desktop (> 1024px)
  3. Використати SCSS mixins: `@include mobile {}`, `@include tablet {}`, `@include desktop {}`
- **Очікуваний результат:** Grid адаптується під breakpoints; SCSS mixins працюють коректно для кожного діапазону
- **Пріоритет:** Високий

### TC-S-E16-S10-02: WCAG 2.1 AA — контраст та доступність
- **Передумови:** Компоненти використовують design tokens
- **Кроки:**
  1. Перевірити контраст тексту на фоні (інструмент типу axe)
  2. Перевірити контраст великого тексту
  3. Перевірити focus states на всіх інтерактивних елементах
- **Очікуваний результат:** Мінімальний контраст 4.5:1 для звичайного тексту; 3:1 для великого тексту; всі інтерактивні елементи мають видимі focus states
- **Пріоритет:** Високий
