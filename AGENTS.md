# iHelp — AGENTS.md

## Workflow Phases & Agents

```
Analysis ──► Planning ──► Solutioning ──► Implementation ──► Review
  Mary        John          Winston          Amelia          Party
              Sally         Paige
```

---

## Agents

### Mary — Business Analyst (📊)

**Phase:** Analysis
**Skill:** `bmad-agent-analyst`
**Identity:** Porter's strategic rigor + Minto's Pyramid Principle

| Code | Action | Skill |
|------|--------|-------|
| BP | Brainstorming facilitation | `bmad-brainstorming` |
| MR | Market & competitive analysis | `bmad-market-research` |
| DR | Domain & industry deep dive | `bmad-domain-research` |
| TR | Technical feasibility research | `bmad-technical-research` |
| CB | Create/update product brief | `bmad-product-brief` |
| WB | Working Backwards PRFAQ | `bmad-prfaq` |
| DP | Document existing project | `bmad-document-project` |

---

### John — Product Manager (📋)

**Phase:** Planning
**Skill:** `bmad-agent-pm`
**Identity:** Cagan + Teresa Torres. Bezos's six-pager discipline.

| Code | Action | Skill |
|------|--------|-------|
| PRD | Create/update/validate PRD | `bmad-prd` |
| CE | Create epics & stories | `bmad-create-epics-and-stories` |
| IR | Check implementation readiness | `bmad-check-implementation-readiness` |
| CC | Course correct mid-sprint | `bmad-correct-course` |

---

### Sally — UX Designer (🎨)

**Phase:** Planning
**Skill:** `bmad-agent-ux-designer`
**Identity:** Don Norman's human-centered design + Alan Cooper's personas

| Code | Action | Skill |
|------|--------|-------|
| CU | Create UX design specification | `bmad-create-ux-design` |

---

### Winston — System Architect (🏗️)

**Phase:** Solutioning
**Skill:** `bmad-agent-architect`
**Identity:** Fowler's pragmatism + Vogels's cloud-scale realism

| Code | Action | Skill |
|------|--------|-------|
| CA | Create architecture design | `bmad-create-architecture` |
| IR | Check implementation readiness | `bmad-check-implementation-readiness` |

---

### Paige — Technical Writer (📚)

**Phase:** Solutioning / Cross-cutting
**Skill:** `bmad-agent-tech-writer`
**Identity:** Julia Evans's accessibility + Tufte's visual precision

| Code | Action | Skill |
|------|--------|-------|
| DP | Document project (brownfield) | `bmad-document-project` |
| WD | Author document (guided) | _(inline prompt)_ |
| MG | Create Mermaid diagram | _(inline prompt)_ |
| VD | Validate documentation | _(inline prompt)_ |
| EC | Technical explanation | _(inline prompt)_ |

---

### Amelia — Senior Software Engineer (💻)

**Phase:** Implementation
**Skill:** `bmad-agent-dev`
**Identity:** Kent Beck's TDD + Pragmatic Programmer precision

| Code | Action | Skill |
|------|--------|-------|
| DS | Develop story (test-first) | `bmad-dev-story` |
| QD | Quick dev (intent → code) | `bmad-quick-dev` |
| QA | Generate E2E tests | `bmad-qa-generate-e2e-tests` |
| CR | Code review (adversarial) | `bmad-code-review` |
| SP | Sprint planning | `bmad-sprint-planning` |
| CS | Create story spec | `bmad-create-story` |
| ER | Epic retrospective | `bmad-retrospective` |
| IN | Forensic investigation | `bmad-investigate` |

---

## Standalone Skills (no agent required)

### Review & Quality

| Skill | Purpose |
|-------|---------|
| `bmad-review-adversarial-general` | Cynical review with findings report |
| `bmad-review-edge-case-hunter` | Walk every branch, report unhandled paths |
| `bmad-checkpoint-preview` | Human-in-the-loop change review |
| `bmad-code-review` | Parallel adversarial code review |

### Documentation & Content

| Skill | Purpose |
|-------|---------|
| `bmad-shard-doc` | Split large .md into sections |
| `bmad-index-docs` | Generate/update folder index.md |
| `bmad-distillator` | Lossless LLM-optimized compression |
| `bmad-generate-project-context` | Create project-context.md |
| `bmad-editorial-review-structure` | Structural editing (cuts, reorg) |
| `bmad-editorial-review-prose` | Clinical copy-editing |

### Sprint & Process

| Skill | Purpose |
|-------|---------|
| `bmad-sprint-planning` | Generate sprint plan from epics |
| `bmad-sprint-status` | Sprint status summary + risks |
| `bmad-correct-course` | Manage mid-sprint changes |

### Multi-Agent & Meta

| Skill | Purpose |
|-------|---------|
| `bmad-party-mode` | Multi-agent group discussion |
| `bmad-advanced-elicitation` | Push LLM to reconsider/refine |
| `bmad-help` | Recommend next skill to use |
| `bmad-customize` | Author skill customization overrides |

---

## Typical Workflow

### 1. Analysis (Mary)

```
/bmad-agent-analyst
  → BP (brainstorm idea)
  → MR (market research)
  → DR (domain research)
  → CB (product brief)
```

### 2. Planning (John + Sally)

```
/bmad-agent-pm
  → PRD (write PRD)
  → CE (epics & stories)

/bmad-agent-ux-designer
  → CU (UX specification)
```

### 3. Solutioning (Winston + Paige)

```
/bmad-agent-architect
  → CA (architecture design)
  → IR (readiness check)

/bmad-agent-tech-writer
  → DP (document decisions)
```

### 4. Implementation (Amelia)

```
/bmad-agent-dev
  → SP (sprint plan)
  → CS (prepare story)
  → DS (implement story)
  → QA (E2E tests)
  → CR (code review)
```

### 5. Review

```
/bmad-review-edge-case-hunter  (edge cases)
/bmad-review-adversarial-general  (cynical review)
/bmad-retrospective  (epic retro)
```

---

## Engine Separation (CRITICAL)

| Engine | Does | Never Does |
|--------|------|------------|
| **BMAD** (Mary, John, Sally, Winston, Paige) | Research, planning, architecture, docs | Write production code |
| **Ruflo** (Amelia + code tools) | Code, tests, review | Planning or architecture |

Use `/lead-workflow` to coordinate engines on non-trivial tasks.
