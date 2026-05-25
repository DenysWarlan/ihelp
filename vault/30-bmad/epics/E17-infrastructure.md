---
title: "E17 — Infrastructure & DevOps"
type: epic
status: draft
epic-id: E17
created: 2026-05-24
---

# E17 — Infrastructure & DevOps

## Мета

Розгорнути базову інфраструктуру платформи: backend (NestJS), frontend (Angular), базу даних (PostgreSQL + Prisma), кешування та черги (Redis/Bull), файлове сховище, контейнеризацію та CI/CD pipeline.

## Скоуп

### Включено

- **Backend**: NestJS project scaffold, модульна архітектура, global exception filter, request validation (class-validator), health check endpoint
- **Frontend**: Angular standalone project, build/serve configuration, environment configs (dev/staging/prod)
- **База даних**: PostgreSQL setup, Prisma ORM з initial schema (User, Role, Session), migrations workflow
- **Redis**: Bull queues (email, notifications, SLA timers), Socket.io adapter для горизонтального масштабування
- **Файлове сховище**: S3-compatible API (MinIO для dev, AWS S3 для prod), upload/download service з лімітом 10 МБ
- **Docker Compose (dev)**: postgres, redis, minio, backend, frontend — one-command startup
- **Nginx reverse proxy**: routing `/api` -> backend, `/` -> frontend, WebSocket upgrade для Socket.io
- **TLS**: Let's Encrypt (staging/prod), self-signed (dev)
- **CI/CD pipeline**: lint, unit tests, build, Docker image push, deploy to staging
- **Environment management**: `.env` templates, secrets injection, config validation on startup
- **Logging**: structured JSON logs (pino/winston), correlation ID per request
- **Rate limiting**: global + per-endpoint (auth: 5 req/15 min)

### Виключено

- Kubernetes / cloud orchestration (post-MVP, Docker Compose достатньо)
- Monitoring / APM (Grafana, Sentry — окремий epic post-MVP)
- CDN для статики
- Blue-green / canary deployments

## Джерело

architecture.md ADR-001..003

## Вимоги PRD (нефункціональні)

| Секція PRD | Вимога |
|------------|--------|
| 5.1 | LCP < 2s, API P95 < 300ms, WebSocket до 200 з'єднань |
| 5.2 | TLS 1.3, AES-256 at rest, audit logging, rate limiting |
| 5.4 | Stateless backend, індекси PostgreSQL (careCaseId, channel, createdAt) |
| 5.5 | Uptime 99.5%, maintenance 02:00-06:00 UTC+2, auto-restart crisis service |
| 5.6 | i18n-ready архітектура, основна мова — українська |

## Критерії приймання

1. `docker compose up` піднімає повний dev-стек за < 2 хвилини
2. Backend стартує, відповідає на `/health` з 200 OK
3. Frontend збирається та обслуговується через Nginx
4. Prisma migrations застосовуються автоматично при старті
5. Redis підключений: Bull queue працює, Socket.io adapter налаштований
6. CI pipeline: push у main -> lint + test + build + deploy staging
7. Environment validation: backend не стартує з відсутніми обов'язковими змінними
8. Structured logs з correlation ID у кожному запиті

## Залежності

Немає — E17 є фундаментом для всіх інших епіків.

## Поза скоупом

- Terraform / IaC для cloud provisioning
- Backup/restore automation (ручний backup PostgreSQL у MVP)
- Performance testing / load testing
- Observability stack (Prometheus, Grafana, Jaeger)
