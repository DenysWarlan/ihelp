---
epic: E16
story: S-E16-04
title: "Тест-кейси: Sidebar — responsive поведінка"
---

# Тест-кейси: S-E16-04 — Sidebar — responsive поведінка

## Контекст
Ця сторія реалізує responsive-поведінку sidebar на різних розмірах екрану. Тести перевіряють стани sidebar (розгорнутий на desktop, collapsed на tablet, hamburger на mobile) та плавність CSS transition анімації відкриття/закриття.

### TC-S-E16-S04-01: Sidebar на різних розмірах екрану
- **Передумови:** Авторизований користувач
- **Кроки:**
  1. Відкрити на desktop (> 1024px) — перевірити sidebar
  2. Змінити viewport на tablet (768–1024px) — перевірити sidebar
  3. Змінити viewport на mobile (< 768px) — перевірити sidebar
- **Очікуваний результат:** Desktop: sidebar розгорнутий, завжди видимий; Tablet: sidebar collapsed, можна розгорнути; Mobile: sidebar collapsed, відкривається через hamburger
- **Пріоритет:** Високий

### TC-S-E16-S04-02: Анімація відкриття/закриття sidebar
- **Передумови:** Mobile або tablet viewport; авторизований користувач
- **Кроки:**
  1. Натиснути hamburger-іконку для відкриття
  2. Натиснути для закриття
- **Очікуваний результат:** Sidebar відкривається та закривається з плавною CSS transition анімацією
- **Пріоритет:** Низький
