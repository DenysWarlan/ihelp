# Phase 3 — Solutioning

Engine: **BMAD**
Roles: **Architect, PM**
Output: `vault/30-bmad/architecture/`, `vault/30-bmad/epics/`
Required: **Yes** — architecture, epics, and readiness check are all required gates

---

## Steps

### 3.1 Create Architecture (REQUIRED)
- Skill: `bmad-create-architecture`
- Role: Architect
- Input: PRD, UX design (if exists)
- Output: `vault/30-bmad/architecture/`
- Gate: cannot create epics without architecture

### 3.2 Create Epics & Stories (REQUIRED)
- Skill: `bmad-create-epics-and-stories`
- Role: PM
- Input: PRD, architecture
- Output: `vault/30-bmad/epics/`
- After: 3.1
- Gate: cannot proceed to implementation without epics

### 3.3 Check Implementation Readiness (REQUIRED)
- Skill: `bmad-check-implementation-readiness`
- Role: Lead
- Input: PRD, UX, architecture, epics
- Output: readiness report
- After: 3.2
- Gate: must pass before Phase 4

---

## Flow

```
Create Architecture ──→ Create Epics & Stories ──→ Readiness Check
                                                        │
                                              ┌─────────┴─────────┐
                                              │                   │
                                            PASS               FAIL
                                              │                   │
                                              ↓                   ↓
                                        Phase 4            Fix gaps, re-check
                                     (Implementation)     (loop back to 3.1-3.2)
```

---

## Readiness Criteria

The readiness check validates alignment across:
- PRD requirements are fully covered by architecture
- Architecture decisions are reflected in epics
- Epics have enough detail for story creation
- No contradictions between documents
- UX flows match PRD features (if UX exists)

If readiness fails — fix the identified gaps in the relevant document before re-checking. Use `bmad-correct-course` if changes are significant.

---

## Completion Check

Phase 3 is complete when:
- Architecture doc exists in `vault/30-bmad/architecture/`
- Epics exist in `vault/30-bmad/epics/`
- Readiness check passes
