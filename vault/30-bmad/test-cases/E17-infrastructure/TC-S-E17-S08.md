---
epic: E17
story: S-E17-08
title: "Тест-кейси: CI/CD Pipeline"
---

# Тест-кейси: S-E17-08 — CI/CD Pipeline

## Контекст
Ця сторія реалізує CI/CD pipeline (GitHub Actions або GitLab CI) з етапами lint, test, build, Docker image push та deploy на staging. Тести перевіряють послідовне виконання всіх етапів, обов'язковість PR checks для merge та коректне тегування Docker images.

### TC-S-E17-S08-01: Pipeline — lint, test, build, deploy
- **Передумови:** CI/CD pipeline налаштований (GitHub Actions або GitLab CI)
- **Кроки:**
  1. Push коміт у main
  2. Перевірити виконання pipeline: lint -> unit tests -> build -> Docker image push -> deploy to staging
- **Очікуваний результат:** Всі кроки виконуються послідовно; при успіху — deploy на staging автоматичний
- **Пріоритет:** Високий

### TC-S-E17-S08-02: PR checks обов'язкові для merge
- **Передумови:** Pull Request з lint-помилкою або failing тестом
- **Кроки:**
  1. Створити PR з lint-помилкою
  2. Спробувати merge
- **Очікуваний результат:** Merge заблокований; PR checks (lint + tests) відображаються як failed
- **Пріоритет:** Високий

### TC-S-E17-S08-03: Docker images тегування
- **Передумови:** Successful pipeline build
- **Кроки:**
  1. Перевірити Docker registry після build
- **Очікуваний результат:** Docker image тегується двома тегами: `latest` та git SHA коміту
- **Пріоритет:** Середній
