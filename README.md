# Vayal-to-Vaasal — Project Standards Pack

## Files
- `BRD.md` — business goals, scope, requirements, rules, acceptance criteria.
- `DESIGN_SYSTEM.md` — visual tokens, layouts, components, data presentation, accessibility.
- `ARCHITECTURE.md` — app layers, data flow, domain invariants, persistence, future integration seam.
- `SECURITY.md` — prototype boundaries, data handling, secure coding, production prerequisites.
- `CODE_STYLE.md` — TypeScript/React conventions and implementation workflow.
- `TESTING.md` — test layers, edge cases, acceptance scenarios, release gate.
- `AGENTS.md` — instructions for coding agents.

## How to use
1. Copy these files to the repository root beside `package.json` and `MASTER_PROMPT.md`.
2. Keep `MASTER_PROMPT.md` as the original full brief; use `BRD.md` as the structured requirements reference.
3. For future coding tasks, ask the agent to read `AGENTS.md` and the relevant companion docs first.
4. Request one coherent feature or stage at a time, with clear acceptance criteria.
5. Update the documents when business rules or actual architecture change.

## Source and assumptions
Based on the supplied Vayal-to-Vaasal master brief. Proposed targets remain targets, not observed results. Architecture and coding conventions are guidance and must be reconciled with the actual repository. Production security prerequisites are not claims that the prototype implements them.
