# Phase 4 — Implementation

Roles: **Dev, QA, Reviewer** (execution), **Lead** (orchestration)
Output: `apps/`, `libs/` (code), `vault/30-bmad/stories/` (tracking), `vault/40-features/` (specs & reviews)
Required: **Yes** — sprint planning and story cycle are required

---

## Execution Rules

### HARD RULES
- DO NOT do planning in this phase — that's Phases 1-3
- DO NOT implement directly as Lead — delegate to Dev/QA/Reviewer
- EVERY feature MUST have a feature spec from template BEFORE coding starts
- EVERY feature MUST pass code review BEFORE merge
- Developer MUST update documentation if architecture/API changed

### Dynamic Agent Resolution

Agents are NOT hardcoded. The Lead resolves the best agent for each task:

1. **Detect tech stack** — scan `package.json`, `angular.json`, `nest-cli.json`, `nx.json`, etc.
2. **Check local agents** — look in `vault/00-system/agents/` then `.claude/agents/`
3. **Check installed skills** — look in `.claude/skills/` for matching skills
4. **Auto-install if missing** — search registries and install:

```
Registry 1: skills.sh
  → Search: WebFetch https://skills.sh/ for "{tech} development"
  → Install: npx skillsadd {owner/repo}

Registry 2: github.com/msitarzewski/agency-agents
  → Browse: https://github.com/msitarzewski/agency-agents/tree/main/{category}/
  → Categories: engineering/, testing/, design/
  → Download agent .md to .claude/agents/{agent-name}.md

Log: append to vault/60-decisions/auto-installed.md
```

### Execution Roles

| Role | Purpose | Resolution Example |
|------|---------|-------------------|
| **Dev** | Write production code | Detect Angular → find angular skill/agent; detect Nest → find nestjs skill/agent |
| **QA** | Test generation, validation | Find testing/QA agent matching the stack |
| **Reviewer** | Code review, quality gates | Find code-reviewer agent or skill |

### Delegation Format

```
[Task → {Role}]
Mode: Execute
Agent: {dynamically resolved agent}
Source: {local | skills.sh | agency-agents}
Inputs: {story spec, existing code context}
Expected output: {code files, tests}
Constraints: {from agent definition}
Allowed paths: apps/, libs/
```

### Tool Routing

| Action | Role |
|--------|------|
| Create feature spec | Dev |
| Write code | Dev |
| Write tests | QA |
| Review code | Reviewer |
| Update docs | Dev |
| Track progress | Lead |
| Course correct | Lead (→ may escalate to Phases 1-3) |

---

## Templates

All vault files MUST be created from templates in `vault/00-system/templates/`:

| Artifact | Template |
|---|---|
| Feature spec | `40-features--feature.md` |
| Task | `40-features--tasks.md` |
| Code review | `40-features--review.md` |
| QA report | `40-features--qa.md` |
| Result | `40-features--result.md` |
| ADR | `60-decisions--adr.md` |

**Procedure:**
1. Read the template FIRST
2. Create the file copying frontmatter + section structure exactly
3. Fill in placeholders (`<...>`)
4. NEVER create vault files without using a template

---

## Steps

### 4.1 Sprint Planning (REQUIRED)
- Skill: `bmad-sprint-planning`
- Role: Lead
- Input: epics from Phase 3
- Output: `vault/30-bmad/stories/sprint-status.md`
- Gate: must plan before executing stories

### 4.2 Sprint Status
- Skill: `bmad-sprint-status`
- Role: Lead
- When: anytime during sprint to check progress and surface risks
- Output: status summary

---

## Story Cycle (repeat for each story)

### 4.3 Create Story (REQUIRED)
- Skill: `bmad-create-story` (action: `create`)
- Role: Lead
- Input: sprint plan, epics
- Output: `vault/30-bmad/stories/{story-name}.md`
- Picks the next story from sprint plan

### 4.4 Validate Story
- Skill: `bmad-create-story` (action: `validate`)
- Role: Lead
- Input: story from 4.3
- Output: story validation report
- After: 4.3
- Recommended before dev

### 4.5 Create Feature Spec (REQUIRED)
- Role: **Dev** (execution)
- Template: `vault/00-system/templates/40-features--feature.md`
- Input: validated story + architecture doc + PRD
- Output: `vault/40-features/{feature-name}/spec.md`
- After: 4.3 (or 4.4 if validated)
- **Must include:**
  - Technical plan (files to create/change)
  - Tasks with acceptance criteria
  - Test plan
  - Code review checklist
  - Documentation update checklist

### 4.6 Dev Story (REQUIRED)
- Skill: `bmad-dev-story`
- Role: **Dev** (execution)
- Input: feature spec from 4.5
- Output: production code in `apps/`, `libs/`
- After: 4.5
- **Planning is FORBIDDEN here — execution only**
- **MUST follow feature spec tasks sequentially**
- **MUST mark tasks [x] in spec as completed**

### 4.7 Dev Self-Check (REQUIRED)
- Role: **Dev** (execution)
- After: 4.6
- Before submitting for review, developer MUST:
  1. Verify ALL tasks in feature spec are marked `[x]`
  2. Run linter (`npm run lint` / `ng lint`)
  3. Run unit tests (`npm test`)
  4. Check TypeScript compilation (`tsc --noEmit`)
  5. Review own diff against feature spec — does code match plan?
  6. Update feature spec status to `in-review`

### 4.8 Update Documentation (REQUIRED if applicable)
- Role: **Dev** (execution)
- After: 4.6
- Check documentation update checklist in feature spec:
  - [ ] **API docs** — new/changed endpoints → update OpenAPI/Swagger or API section in architecture doc
  - [ ] **Architecture doc** — new modules, changed patterns, new integrations → update `vault/30-bmad/architecture/`
  - [ ] **Database schema** — new/changed models → update Prisma schema section in architecture doc
  - [ ] **README** — new dependencies, new env vars, new commands → update project README
  - [ ] **ADR** — significant technical decision made during implementation → create ADR from template `vault/00-system/templates/60-decisions--adr.md`
- **If nothing changed** — mark all items as N/A in feature spec
- **If docs updated** — list changed files in feature spec "Documentation updated" section

### 4.9 Code Review (REQUIRED)
- Template: `vault/00-system/templates/40-features--review.md`
- Role: **Reviewer** (execution)
- Input: code changes from 4.6, feature spec from 4.5
- Output: `vault/40-features/{feature-name}/review.md`
- After: 4.7
- **Review process:**
  1. Read feature spec
  2. Read diff (all changed files)
  3. Create review report from template
  4. Check against review checklist:
     - **Correctness** — does code match spec?
     - **Architecture** — follows architecture doc?
     - **Security** — OWASP, auth guards, input validation
     - **Code quality** — TypeScript strict, no any, naming
     - **Tests** — coverage, meaningful assertions
     - **Documentation** — docs updated per checklist (step 4.8)
  5. Classify findings:
     - **Critical** — blocks merge, must fix
     - **Important** — should fix before merge
     - **Recommendation** — developer's choice
  6. Set status: `approved` | `changes-requested` | `rejected`
- If `changes-requested`:
  - Dev fixes issues → back to 4.7 (self-check)
  - Increment review `iteration` in frontmatter
  - Max 3 iterations, then escalate to Lead
- If `approved` → proceed to 4.10

### 4.10 QA / Tests
- Template: `vault/00-system/templates/40-features--qa.md`
- Role: **QA** (execution)
- Input: implemented code, feature spec
- Output: `vault/40-features/{feature-name}/qa.md`
- After: 4.6
- Can run **parallel with 4.9** (code review)
- **QA process:**
  1. Read feature spec acceptance criteria
  2. Run existing test suite — verify no regressions
  3. Write additional tests if needed
  4. Verify each acceptance criterion
  5. Create QA report from template
  6. Set status: `pass` | `fail` | `partial`
- If `fail` → Dev fixes → re-run QA

### 4.10.1 Playwright E2E Tests (web apps only)
- Tool: Playwright MCP (browser automation)
- Role: **QA** (execution)
- When: project is a web application (detected via `angular.json`, `next.config`, `vite.config`, or similar)
- After: 4.6 (code implemented and runnable)
- Input: running dev server + story acceptance criteria
- Procedure:
  1. Start dev server (`nx serve` or `npm run dev`)
  2. Use Playwright MCP tools to navigate, interact, and validate:
     - `browser_navigate` — open the app
     - `browser_snapshot` — capture page state
     - `browser_click`, `browser_fill_form` — interact with UI
     - `browser_take_screenshot` — visual evidence of test results
  3. Validate each acceptance criterion from the story
  4. Save screenshots to `vault/90-assets/qa/{feature-name}/`
  5. Report: PASS with evidence or FAIL with screenshots + description
- Output: test report + screenshots in `vault/90-assets/qa/`
- Can run parallel with 4.9

### 4.11 Feature Result (REQUIRED)
- Template: `vault/00-system/templates/40-features--result.md`
- Role: **Dev** (execution)
- After: 4.9 (review approved) + 4.10 (QA passed)
- Output: `vault/40-features/{feature-name}/result.md`
- **Must include:**
  - List of created/changed files
  - Test results summary
  - Documentation changes made
  - Known limitations
  - Deferred work (if any)
  - Dev notes (what was hard, what to know)

### 4.12 Checkpoint Preview
- Skill: `bmad-checkpoint-preview`
- Role: Lead
- When: before merging, after review + QA pass
- Purpose: human-in-the-loop review of the change
- Gate: review APPROVED + QA PASS required

---

## Feature Folder Structure

Each feature creates a folder in `vault/40-features/`:

```
vault/40-features/{feature-name}/
├── spec.md          ← feature spec (from template)
├── review.md        ← code review report (from template)
├── qa.md            ← QA report (from template)
└── result.md        ← final result (from template)
```

---

## Epic Completion

### 4.13 Retrospective
- Skill: `bmad-retrospective`
- Role: Lead
- When: epic is complete (all stories done)
- Output: `vault/80-retros/`
- If major issues → consider `bmad-correct-course`

---

## Story Cycle Flow

```
Sprint Planning
      │
      ↓
┌─→ Create Story ──→ Validate Story (optional)
│         │
│         ↓
│    Create Feature Spec (from template)
│         │
│         ↓
│    Dev Story ──→ Dev Self-Check
│         │                     │
│         │                     ↓
│         │              Update Documentation
│         │                     │
│    ┌────┼─────────────────────┤
│    ↓    ↓                     ↓
│  Code   QA Tests         Playwright E2E
│  Review (parallel)       (web apps only)
│    │
│    ├── changes requested → Dev fixes → Self-Check → re-Review
│    │
│    ↓ (approved + QA pass)
│  Feature Result (from template)
│    │
│    ↓
│  Checkpoint Preview
│    │
│    ↓
│  Story DONE
│    │
└────┤ next story in sprint
     │
     ↓ (all stories done)
   Epic complete → Retrospective → next epic or CLOSE
```

---

## Quality Gates

| Gate | Required | Blocks |
|------|----------|--------|
| Feature spec exists | Yes | Dev start |
| Dev self-check passes | Yes | Review submission |
| Code review APPROVED | Yes | Merge |
| QA PASS | Yes | Merge |
| Documentation updated | Yes (if applicable) | Review approval |
| Feature result written | Yes | Story closure |

---

## Course Correction

If significant changes are needed mid-sprint:
- Skill: `bmad-correct-course`
- May recommend: update PRD, redo architecture, re-plan sprint, or correct epics/stories
- Output: change proposal in `vault/60-decisions/`

---

## Completion Check

Phase 4 is complete when:
- All stories in sprint are done and reviewed
- All feature folders have: spec + review (approved) + qa (pass) + result
- Documentation is up to date
- Tests pass
- Retro completed (if epic boundary)