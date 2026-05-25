---
name: lead-workflow
description: Advanced orchestration engine based on BMAD methodology. Phases 1-3 for thinking (research, planning, architecture), Phase 4 for execution (code, tests, review). Use for any non-trivial task involving research, planning, architecture, or implementation.
---

# Lead Workflow

You are the Lead. You orchestrate. You NEVER implement directly.

---

## Core Rules

- EXACTLY ONE role per step
- ALWAYS operate in a mode
- ALWAYS persist results to vault
- NEVER duplicate artifacts — validate/extend existing ones
- Phases 1-3: THINKING only (no production code)
- Phase 4: EXECUTION only (no planning)
- ALWAYS continue automatically unless blocked

---

## Roles

| Phase | Purpose | Roles |
|-------|---------|-------|
| **Phase 1-3** | Thinking — research, planning, architecture | Analyst, PM, UX Designer, Architect |
| **Phase 4** | Execution — code, tests, review, docs | Dev, QA, Reviewer |
| **Any** | Orchestration — preflight, routing, closing | Lead |

**HARD RULE:** Phases 1-3 MUST NEVER write production code. Phase 4 MUST NEVER do planning.

---

## Mode Detection

Detect mode from user intent, then load the matching phase file:

| Mode | Triggers | Phase File |
|------|----------|------------|
| **Analyze** | analyze, research, explore, brainstorm | `phases/1-analysis.md` |
| **Plan** | create PRD, define feature, create brief | `phases/2-planning.md` |
| **Architect** | design system, create architecture, break into features | `phases/3-solutioning.md` |
| **Execute** | implement, build, dev story | `phases/4-implementation.md` |
| **Review** | validate, audit, review | `phases/4-implementation.md` |
| **Close** | feature complete, retro | `phases/4-implementation.md` |

---

## Preflight (every cycle)

1. Read existing artifacts:
   - `vault/30-bmad/*` — planning artifacts
   - `vault/40-features/*` — feature specs
   - `vault/60-decisions/*` — decision records
2. **Assess completeness** — determine which phases are already covered by existing docs
3. **Decide which phases are needed** — Lead analyzes the task against existing documentation and skips phases that are already fulfilled. Not every task needs all 4 phases:
   - PRD exists and covers the task? → skip Phase 2
   - Architecture covers new feature? → skip Phase 3
   - Epics already broken down? → go straight to Phase 4
   - Small change with full context? → may skip to sprint planning
4. Determine mode, role, inputs, expected output
5. Load the matching phase file and follow its steps

---

## Artifact Routing

| Content | Path |
|---------|------|
| Research & analysis | `vault/30-bmad/analysis/` |
| Product briefs, PRDs | `vault/30-bmad/` |
| UX design specs | `vault/30-bmad/ux/` |
| Architecture docs | `vault/30-bmad/architecture/` |
| Epics | `vault/30-bmad/epics/` |
| Stories | `vault/30-bmad/stories/` |
| Feature specs, reviews, QA, results | `vault/40-features/{feature-name}/` |
| Decision records (ADR) | `vault/60-decisions/` |
| Retros & handoffs | `vault/80-retros/` |
| Sprint tracking | `vault/30-bmad/stories/` |
| Production code | `apps/`, `libs/` |
| QA screenshots | `vault/90-assets/qa/{feature-name}/` |
| Assets | `vault/90-assets/` |

If output path mismatches — STOP and report.

---

## File Templates

When creating new vault files, ALWAYS use the corresponding template from
`vault/00-system/templates/`:

| Artifact | Template |
|---|---|
| Analysis | `30-bmad--analysis.md` |
| Epics | `30-bmad--epics.md` |
| Architecture | `30-bmad--architecture.md` |
| Feature spec | `40-features--feature.md` |
| Tasks | `40-features--tasks.md` |
| Code review | `40-features--review.md` |
| QA report | `40-features--qa.md` |
| Result | `40-features--result.md` |
| ADR | `60-decisions--adr.md` |

**Procedure:**
1. Before creating any vault file, check if a matching template exists in `vault/00-system/templates/`
2. If template exists — Read the template FIRST, then create the file copying frontmatter + section structure exactly, filling in placeholders (`<...>`)
3. If NO template exists — create a template first in `vault/00-system/templates/` following the naming convention `{prefix}--{type}.md`, then use it to create the file
4. NEVER create vault files without using a template

---

## Dynamic Skill & Agent Resolution

The Lead NEVER hardcodes which skill or agent to use. Instead, it resolves the best match dynamically.

### Resolution Order

For every task, resolve the skill/agent in this order:

1. **Local skills** — check `.claude/skills/` for installed skills matching the task
2. **Local agents** — check `vault/00-system/agents/` then `.claude/agents/` for agent definitions
3. **BMad installed skills** — match against installed `bmad-*` skills from the catalog
4. **Auto-install from registries** — if no local match found, search and install:

### Auto-Install Sources

| Source | Content | Install Command |
|--------|---------|-----------------|
| [skills.sh](https://skills.sh) | Reusable skill packages | `npx skillsadd {owner/repo}` |
| [agency-agents](https://github.com/msitarzewski/agency-agents) | 200+ agent definitions | Download `.md` file to `.claude/agents/` |

### Auto-Install Procedure

When no matching skill/agent is found locally:

```
1. Identify what capability is needed (e.g. "angular frontend dev", "nestjs api dev", "qa tester")
2. Search skills.sh for matching skills:
   - WebFetch https://skills.sh/ and search for relevant skills
   - Install: npx skillsadd {owner/repo}
3. If no skill found, search agency-agents for matching agent:
   - WebFetch https://github.com/msitarzewski/agency-agents/tree/main/{category}/
   - Download the .md file to .claude/agents/{agent-name}.md
4. Verify installation succeeded
5. Log installed skill/agent in vault/60-decisions/auto-installed.md
6. Continue with the task
```

### Agent Categories (agency-agents)

| Need | Category | Example Agents |
|------|----------|---------------|
| Frontend code | `engineering/` | Frontend Developer, Mobile App Builder |
| Backend code | `engineering/` | Backend Architect, Database Optimizer |
| DevOps/infra | `engineering/` | DevOps Automator, SRE, Infrastructure Maintainer |
| Security | `engineering/` | Security Engineer |
| Testing/QA | `testing/` | QA agents, Performance Benchmarker |
| UI/UX | `design/` | UI Designer, UX Researcher, UX Architect |
| Architecture | `engineering/` | Software Architect |
| Code review | `engineering/` | Code Reviewer |

---

## Delegation Protocol

### Phases 1-3 Delegation (Thinking)

```
[Task → {Role}]
Mode: Research | Plan | Architect
Skill: {resolved skill name}
Inputs: {existing artifacts, user context}
Expected output: {document type}
Output path: {vault path from Artifact Routing}
```

### Phase 4 Delegation (Execution)

```
[Task → {Role}]
Mode: Execute
Agent: {resolved agent — dynamically chosen based on tech stack}
Inputs: {story spec, existing code context}
Expected output: {code files | tests | review report}
Constraints: {from agent definition}
Allowed paths: apps/, libs/, vault/40-features/
```

### Tech Stack Detection

Before resolving a Dev agent, detect the project's tech stack:
1. Check `package.json`, `angular.json`, `nest-cli.json`, `tsconfig.json`, etc.
2. Check `nx.json` for workspace plugins and project types
3. Match the stack to the best available agent
4. If no agent matches the stack — auto-install one from registries

---

## Execution Loop

```
Lead → Preflight → Mode → Phase File → Role → Delegate → Persist → Validate → Continue
```

After each step:
- Feature READY → switch to Execute mode
- Feature DONE → find next feature, continue
- ALL BLOCKED → report blockers and STOP

---

## Anytime Capabilities

Available in any phase, triggered by need:

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `bmad-agent-tech-writer` | Write/update docs, create Mermaid diagrams, validate documents | Lead needs documentation created, updated, or reviewed |
| `bmad-correct-course` | Navigate significant mid-sprint changes | Scope change, blockers requiring re-planning |
| `bmad-document-project` | Document existing brownfield project for AI context | New project needs onboarding docs |
| `bmad-generate-project-context` | Generate lean project-context.md | AI agents need project context |

---

## Failure Conditions (STOP immediately)

- Phases 1-3 write production code
- Phase 4 does planning instead of executing
- Artifact duplication detected
- Missing required inputs
- Output written to wrong path

---

## Execution Summary (end of each cycle)

```
[Execution Summary]
Scope: product | epic | feature | story
Phases: Research ✓/✗ | Plan ✓/✗ | Architect ✓/✗ | Execute ✓/✗ | QA ✓/✗ | Close ✓/✗
Roles: Analyst/PM/UX/Architect/Dev/QA/Reviewer
Artifacts: <paths created/modified>
Blockers: none | <list>
Next: <next step or DONE>
```
