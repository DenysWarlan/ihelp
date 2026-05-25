# Phase 2 — Planning

Engine: **BMAD**
Roles: **PM, UX Designer**
Output: `vault/30-bmad/`
Required: **Yes** — PRD is the first required gate

---

## Steps

### 2.1 Create PRD (REQUIRED)
- Skill: `bmad-create-prd`
- Role: PM
- Input: product brief or PRFAQ from Phase 1 (or user knowledge)
- Output: `vault/30-bmad/prd.md`
- Gate: cannot proceed to Phase 3 without a PRD

### 2.2 Validate PRD
- Skill: `bmad-validate-prd`
- Role: PM
- Input: PRD from 2.1
- Output: validation report
- After: 2.1
- Recommended before proceeding

### 2.3 Edit PRD
- Skill: `bmad-edit-prd`
- Role: PM
- Input: PRD + validation findings
- Output: updated PRD
- After: 2.2
- Only if validation found issues

### 2.4 Create UX Design
- Skill: `bmad-create-ux-design`
- Role: UX Designer
- Input: PRD
- Output: `vault/30-bmad/ux/`
- After: 2.1
- Recommended if the product has a UI

---

## Flow

```
Create PRD ──→ Validate PRD ──┬──→ Edit PRD (if issues) ──→ re-validate
                              │
                              ↓ (PRD clean)
                        Create UX Design (if UI product)
                              │
                              ↓
                        Phase 3 (Solutioning)
```

---

## PRD Validation Cycle

If validation finds issues:
1. Run `bmad-edit-prd` to fix
2. Re-run `bmad-validate-prd`
3. Repeat until clean

---

## Completion Check

Phase 2 is complete when:
- PRD exists and passes validation
- UX design exists (if applicable) or explicitly skipped
