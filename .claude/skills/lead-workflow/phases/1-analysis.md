# Phase 1 — Analysis

Engine: **BMAD**
Roles: **Analyst**
Output: `vault/30-bmad/analysis/`
Required: **No** — all steps are optional, but recommended for new products

---

## Available Steps

### 1.1 Brainstorm Project
- Skill: `bmad-brainstorming`
- When: idea is forming, need to generate/refine concepts
- Output: brainstorming session doc

### 1.2 Market Research
- Skill: `bmad-market-research`
- When: need competitive landscape, customer needs, market trends
- Output: market research doc

### 1.3 Domain Research
- Skill: `bmad-domain-research`
- When: need deep dive into industry domain, terminology, patterns
- Output: domain research doc

### 1.4 Technical Research
- Skill: `bmad-technical-research`
- When: need technical feasibility analysis, architecture options
- Output: technical research doc

### 1.5 Create Product Brief
- Skill: `bmad-product-brief`
- When: concept is clear, need to document it concisely
- Flag: `-A` for autonomous mode
- Output: product brief
- Alternative: PRFAQ Challenge (1.6)

### 1.6 PRFAQ Challenge
- Skill: `bmad-prfaq`
- When: need to stress-test concept through Working Backwards
- Flag: `-H` for guided mode
- Output: PRFAQ document
- Alternative: Product Brief (1.5)

---

## Flow

```
Brainstorm ──┐
Market Res ──┤
Domain Res ──┼──→ Brief OR PRFAQ ──→ Phase 2 (Planning)
Tech Res   ──┘
```

All research steps can run in any order or be skipped.
At least one of Brief (1.5) or PRFAQ (1.6) is recommended before Phase 2.

---

## Completion Check

Phase 1 is complete when:
- A product brief OR PRFAQ exists in `vault/30-bmad/analysis/`
- OR the user explicitly says to skip to Phase 2
