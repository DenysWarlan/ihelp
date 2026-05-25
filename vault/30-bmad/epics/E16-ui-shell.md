---
title: "E16 — UI Shell & Design System"
type: epic
status: draft
epic-id: E16
created: 2026-05-24
---

# E16 — UI Shell & Design System

## Мета

Створити базовий UI-каркас (shell) та дизайн-систему з токенами, типографікою та переиспользовуваними компонентами для всіх ролей платформи.

## Скоуп

### Включено

- **App Shell**: Angular standalone app з lazy-loaded route modules
- **Sidebar навігація**: рольова (Person, Consultant, Supervisor, Coordinator, Admin), responsive (collapse на mobile)
- **Navbar (публічний)**: Логотип, Курси, Увійти
- **Design tokens**: `$accent`, `$bg`, `$surface`, `$text`, `$error`, `$warning`, `$success` та інші з ihelp-design.pen
- **Типографіка**: Inter (UI), Geist Mono (code/data), шкала розмірів
- **Іконки**: Lucide icon set, Angular wrapper
- **Базові компоненти**:
  - Badge (статуси кейсів, пріоритети)
  - Progress bar (курси, навантаження)
  - Alert banner (crisis, SLA, info)
  - Card (курси, кейси, зустрічі)
  - Table (списки кейсів, користувачів)
  - Form inputs (text, select, checkbox, textarea) з валідацією
  - Button (primary, secondary, danger, disabled states)
  - Modal (авторизація, підтвердження)
- **Layout grid**: responsive breakpoints (mobile, tablet, desktop)
- **Dark/light theme support**: CSS custom properties ready (MVP — тільки light)

### Виключено

- Бізнес-логіка екранів (E14, E15, E13)
- Dark theme реалізація (post-MVP)
- Анімації та мікроінтеракції
- Storybook документація (nice-to-have)

## Джерело дизайну

Design System frame у файлі `ihelp-design.pen` — токени, компоненти, сітка, типографіка.

## Критерії приймання

1. Sidebar відображає пункти меню відповідно до ролі поточного користувача
2. Публічний navbar працює для Guest (без авторизації) та Person
3. Усі design tokens задокументовані як CSS custom properties та SCSS variables
4. Типографіка Inter завантажується з self-hosted шрифтів (не Google Fonts CDN)
5. Кожен базовий компонент має варіанти станів (default, hover, active, disabled, error)
6. Layout responsive: mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
7. Sidebar collapsed на mobile, toggle через hamburger
8. Компоненти доступні (WCAG 2.1 AA): contrast ratio, focus states, aria labels

## Залежності

| Епік | Що потрібно |
|------|-------------|
| E17 | Angular project scaffold, build pipeline |

## Поза скоупом

- Реалізація конкретних екранів (тільки shell + компоненти)
- i18n pipe setup (інфраструктура — E17, використання — в кожному епіку)
- Складні компоненти (chat widget, calendar picker) — створюються в епіках-споживачах
