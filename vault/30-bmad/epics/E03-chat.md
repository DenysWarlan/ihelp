---
title: "E03 — Omnichannel Chat"
type: epic
status: draft
epic-id: E03
created: 2026-05-24
prd-refs: CHAT-1, CHAT-2, CHAT-3, CHAT-4, CHAT-5, CHAT-6, CHAT-7, CHAT-14, CHAT-15, CHAT-16
---

# E03 — Omnichannel Chat

## Мета

Забезпечити обмін повідомленнями між Person та консультантом через веб-чат (Socket.io) та Telegram Bot API з єдиною моделлю повідомлення, підтримкою вкладень та збереженням історії редагувань і видалень.

## Scope

### Включено

- Веб-чат на Socket.io з real-time доставкою (CHAT-1)
- Telegram Bot API: прийом та відправка повідомлень через webhook (CHAT-2)
- Unified Message Bus: єдина модель Message для всіх каналів (CHAT-3)
- Модель повідомлення з полем channel (enum: web, telegram; інші зарезервовані) (CHAT-4)
- Єдиний інтерфейс консультанта з іконкою каналу (CHAT-5)
- Маршрутизація відповіді в канал останнього повідомлення Person; health check каналу; fallback chain (CHAT-6)
- Вкладення до 10 МБ; часткове збереження при перевищенні ліміту (CHAT-7)
- Timestamp-based ordering для webhook; дедуплікація по message_id (CHAT-14)
- Fallback на generic adapter при невизначеній платформі (CHAT-15)
- Збереження оригіналу при видаленні/редагуванні в месенджері; історія версій (CHAT-16)

### Виключено

- Viber Bot API (CHAT-8, v1.1)
- Instagram / Facebook Messenger (CHAT-9, CHAT-10, v1.2)
- Перехід між каналами зі збереженням сесії (CHAT-11, v1.1)
- Індикатор "друкує" (CHAT-12, v1.1)
- Статус доставки (CHAT-13, v1.2)

## Вимоги PRD

| ID | Короткий опис | Пріоритет |
|---|---|---|
| CHAT-1 | Веб-чат Socket.io | MVP |
| CHAT-2 | Telegram Bot API | MVP |
| CHAT-3 | Unified Message Bus | MVP |
| CHAT-4 | Єдина модель Message з channel enum | MVP |
| CHAT-5 | Єдиний інтерфейс консультанта | MVP |
| CHAT-6 | Маршрутизація в активний канал + fallback | MVP |
| CHAT-7 | Вкладення до 10 МБ | MVP |
| CHAT-14 | Timestamp ordering, дедуплікація | MVP |
| CHAT-15 | Generic adapter fallback | MVP |
| CHAT-16 | Збереження видалених/редагованих | MVP |

## Критерії приймання

1. Person може надіслати повідомлення через веб-чат; консультант отримує його в real-time
2. Повідомлення з Telegram доставляється консультанту з іконкою каналу
3. Відповідь консультанта доставляється в канал останнього повідомлення Person
4. При недоступності каналу спрацьовує fallback chain; адмін отримує алерт
5. Вкладення > 10 МБ відхиляється; текстова частина зберігається з повідомленням користувачу
6. Webhook-повідомлення сортуються за оригінальним timestamp; дублікати ігноруються
7. Видалене/відредаговане повідомлення в Telegram зберігається; консультант бачить позначку та історію
8. Повідомлення з непідтримуваного каналу повертає 422
9. XSS-контент санітизується перед збереженням (DOMPurify, strip ALL HTML)
10. Socket.io використовує Redis adapter для multi-instance scaling

## Залежності

- **E01 Auth** -- JWT для Socket.io handshake та REST endpoints (передумова)
- **E02 Cases** -- повідомлення прив'язуються до CareCase (передумова)
- **E17 Infrastructure** -- Redis (Socket.io adapter, Bull queues), S3/MinIO (вкладення)
- **E08 Crisis** -- споживає повідомлення для keyword scanning

## Поза scope

- Канали v1.1+ (Viber, Instagram, Facebook)
- "Typing" індикатор
- Delivery/read статуси від месенджерів
- UI дизайн чату (E16 UI Shell)
