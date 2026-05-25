# ihelp — Claude Code Configurati

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS |
| Frontend | Angular 21 (standalone, signals-first) |
| State | NgRx Signal Store (`@ngrx/signals`) |
| Database | PostgreSQL + Prisma |
| Queue | BullMQ + Redis |
| Vector Store | pgvector |
| AI | Claude API (Sonnet 4.6) |
| VCS | GitHub (MVP), GitLab/Bitbucket (v2) |
| Workspace | Nx monorepo (npm) |
| Styling | SCSS + CSS custom properties |
| i18n | Transloco |

---

## Quick Reference

| What | Where |
|------|-------|
| Planning artifacts | `vault/30-bmad/` |
| PRD | `vault/30-bmad/prd.md` |
| Architecture | `vault/30-bmad/architecture/architecture.md` |
| UX spec | `vault/30-bmad/ux/ux.md` |
| Epics & Stories | `vault/30-bmad/epics/`, `vault/30-bmad/stories/` |
| Source code | `libs/`, `apps/` |
| Templates | `vault/00-system/templates/` |

---

## Workflow

Use `/lead-workflow` for non-trivial tasks.

| Engine | Purpose | Never Does |
|--------|---------|------------|
| BMAD | Research, planning, architecture | Writes production code |
| Ruflo | Code, tests, review | Planning or architecture |

See `AGENTS.md` for agent definitions (Mary, John, Sally, Winston, Amelia, Paige).

---

## Before Coding

1. Check existing artifacts in `vault/30-bmad/`
2. Find the story in `vault/30-bmad/stories/`
3. Follow templates from `vault/00-system/templates/`
4. Prefer minimal, surgical changes

---

## Angular Frontend Architecture

### Data Flow (MANDATORY)

```
Component (dumb UI) → Facade → NgRx Signal Store ← HTTP Service (pure)
```

| Layer | Responsibility | Injects |
|-------|---------------|---------|
| **Component** | UI rendering only. No logic, no subscribe, no HTTP | Facade only |
| **Facade** | Form state (signals), validation, navigation, orchestration | Store + Service + Router |
| **Signal Store** | State management (`signalStore`, `rxMethod` for async) | Service |
| **HTTP Service** | Pure HTTP calls returning `Observable<T>`. No state. | HttpClient |

### Component Rules

- Components are **dumb** — inject facade, expose signals, call facade methods
- NO `subscribe()`, NO `takeUntilDestroyed`, NO validation in components
- NO business logic in templates
- NO inline HTML or styles
- Keep TS minimal
- `ChangeDetectionStrategy.OnPush` always
- **Form submit handlers:** `event.preventDefault()` is NOT needed — Angular `(submit)` binding doesn't cause page reload. Use `(submit)="onSubmit()"` not `(submit)="$event.preventDefault(); onSubmit()"`

### Facade Rules

- Own all form state as typed `WritableSignal<T>` — always define an interface for the form model
- Own validation logic
- Own navigation calls
- Orchestrate store methods and service calls
- Helper methods (color lookups, formatting) live here

```typescript
// Correct — explicit types
readonly createOrgModel: WritableSignal<CreateOrgFormModel> = signal({ name: '', slug: '' });
readonly isLoading: Signal<boolean> = this.store.isLoading;
readonly error: Signal<string | null> = this.store.error;

// Forbidden — inferred types
readonly createOrgModel = signal({ name: '', slug: '' });
readonly isLoading = this.store.isLoading;
```

### Signal Store Rules

- Use `signalStore` with `withState`, `withComputed`, `withMethods`
- Use `rxMethod` from `@ngrx/signals/rxjs-interop` for async operations
- `patchState` for state mutations
- `providedIn: 'root'`
- Error handling via `catchError` → `EMPTY`

### HTTP Service Rules

- Pure HTTP layer — NO signals, NO state, NO tap mutations
- Return `Observable<T>` with `catchError` only
- `providedIn: 'root'`

---

## Async & Reactive Rules (CRITICAL)

**Forbidden:** `Promise`, `async/await`, `.then()`, `toPromise`, `firstValueFrom`

**Required:** RxJS Observables + Angular Signals

Operators: `switchMap`, `map`, `tap`, `filter`, `combineLatest`, `forkJoin`, `pipe`

---

## File Naming Convention (MANDATORY)

All files must include folder name + type suffix:

```
button/
  button.component.ts
  button.component.html
  button.component.scss
  button.model.ts
  button.consts.ts
```

Services, facades, and stores:
```
auth/
  service/
    auth.service.ts          (HTTP only)
    auth-facade.service.ts   (orchestration)
  store/
    auth.store.ts            (NgRx Signal Store)
  model/
    auth.model.ts
  const/
    auth.const.ts
```

Never use bare names like `avatar.ts` — always `avatar.component.ts`.

**Common Theme Variables:**
| Category | Variable | Usage |
|----------|----------|-------|
| Background | `--sai-bg-primary`, `--sai-bg-secondary` | Component backgrounds |
| Text | `--sai-text-primary`, `--sai-text-secondary`, `--sai-text-tertiary` | Text colors |
| Brand | `--sai-brand`, `--sai-brand-hover` | Primary actions |
| Border | `--sai-border`, `--sai-border-input` | Borders, dividers |
| Status | `--sai-success`, `--sai-warning`, `--sai-error` | Status indicators |
| Sidebar | `--sai-sidebar-bg`, `--sai-sidebar-active`, `--sai-sidebar-text` | Sidebar styles |

Reference: `libs/shared/ui/src/components/_theme.scss`

---

## Interfaces & Constants (MANDATORY)

**All interfaces and constants MUST be in separate files, never inline with services/components.**

```typescript
// Forbidden — inline in service
@Injectable()
export class MyService {
  private readonly API_URL = 'https://api.example.com';
  private readonly TIMEOUT = 5000;
}

interface MyModel { name: string; }
```

```typescript
// Required — separate files
// my.const.ts
export const API_URL = 'https://api.example.com' as const;
export const TIMEOUT = 5000;

// my.model.ts
export interface MyModel { name: string; }

// my.service.ts
import { API_URL, TIMEOUT } from './my.const';
import { MyModel } from './my.model';

@Injectable()
export class MyService { ... }
```

**NestJS backend:** Use `filename.const.ts` pattern (e.g., `crypto.const.ts`)
**Angular frontend:** Use `model/` and `const/` folders in `data-access` layer

---

## Nx Domain-First Structure (MANDATORY)

```
libs/
  {domain}/
    components/          → presentational UI only
      login-page/
        login-page.component.ts
        login-page.component.html
        login-page.component.scss
    data-access/
      {domain}/
        service/         → HTTP services + facades
        store/           → NgRx Signal Stores
        model/           → interfaces/types
        const/           → constants, endpoints
        guard/           → route guards
    feature/             → routed/container features
    util/                → pure utilities
```

**Rules:**
- Domain-oriented organization first
- `components` = dumb UI only
- `data-access` = facade/store/api/business logic
- Constants belong in `data-access` layer, not in component folders
- No `src/lib`, no NgModules, no business logic in components

---

## SCSS / CSS Variables (MANDATORY)

**NEVER** use hardcoded colors. **ALWAYS** use CSS custom properties from `libs/shared/ui/src/components/_theme.scss`.

```scss
// Forbidden
background-color: #1e1b4b;

// Required
background-color: var(--sai-sidebar-bg);
```

| Category | Variables |
|----------|-----------|
| Background | `--sai-bg-primary`, `--sai-bg-secondary` |
| Text | `--sai-text-primary`, `--sai-text-secondary`, `--sai-text-tertiary` |
| Brand | `--sai-brand`, `--sai-brand-hover` |
| Border | `--sai-border`, `--sai-border-input` |
| Status | `--sai-success`, `--sai-warning`, `--sai-error` |
| Sidebar | `--sai-sidebar-bg`, `--sai-sidebar-active`, `--sai-sidebar-text` |

---

## NestJS Backend

```
controller → service → repository
```

- Controllers = thin, no business logic
- Always use DTOs + `class-validator`
- Swagger decorators on all endpoints: `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`
- Use NestJS exceptions only (`BadRequestException`, `NotFoundException`, `ConflictException`)
- No DB logic in controllers

---

## Testing

| Type | Tool |
|------|------|
| Unit | Vitest |
| E2E | Playwright |
| Legacy | Cypress (do not add new) |

Do not create API-only E2E tests unless explicitly requested.

---

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->

---

## Data Model

- PostgreSQL + Prisma ORM
- Schemas in `vault/30-bmad/architecture/architecture.md` §5
- Multi-tenant: Organization → Project
- Key entities: SupportRequest, ClarificationSession, ChangePlan, CodeChange, PRRecord, DecisionLog

---

## Safety Rules

**Forbidden:** Reading `.env`, accessing secrets, force push, breaking architecture, changing CI without request, using pnpm/yarn (use npm only)

**Always:** Minimal changes, clean architecture, reactive approach, tests for non-trivial logic

## Package Manager (CRITICAL)

**This project uses npm ONLY.** Never use pnpm, yarn, or bun.

- Use `npm install`, `npm run`, `npx nx` — never `pnpm` or `yarn` commands
- `pnpm-lock.yaml` and `yarn.lock` are gitignored — if they appear, delete them
- When adding dependencies, use `npm install <pkg>` or `npx nx g @nx/angular:lib` (which uses npm under the hood)
