# AGENTS.md — Instructions for Coding Agents

These instructions apply to AI coding agents and code assistants in this repository. Read this file plus relevant companion docs before editing:
- `BRD.md`: business scope, rules, acceptance criteria
- `DESIGN_SYSTEM.md`: visual/interaction standards
- `ARCHITECTURE.md`: layers, data flow, domain invariants
- `SECURITY.md`: data handling and security boundaries
- `CODE_STYLE.md`: implementation conventions
- `TESTING.md`: test plan and release gate

If requirements conflict, explain the conflict rather than inventing policy.

## 1. Inspect before changing
1. Read relevant docs and the requested task.
2. Inspect repository tree, `package.json`, TypeScript/lint/test configuration, routing, state management, styles, current components, and git diff.
3. Reuse existing framework, package manager, dependencies, and conventions.
4. Identify the smallest coherent change and acceptance criteria.
5. Read long files in chunks; do not assume a failed/partial read means the content is absent.

## 2. Work, do not just describe
- When implementation is requested, edit actual files and use tools; do not return only a plan, checklist, or summary.
- Work in small, verifiable stages. Run checks at stage boundaries.
- Do not rebuild the repository from scratch unless explicitly asked.
- Do not create disconnected hardcoded arrays for each page; use the shared typed service.
- Keep calculations and mutations outside JSX.
- Make primary controls functional; no dead buttons, fake navigation, meaningless charts, or TODO-only pages presented as complete.
- Do not add dependencies or architecture patterns without inspecting what exists and explaining why.
- Preserve unrelated changes and inspect the diff before editing.

## 3. Business truth and demo integrity
- This is a proposed stakeholder demo, not a deployed government platform.
- Label generated transactional records as synthetic/demo data.
- Separate proposal targets from simulated actuals.
- Never claim real-time data, actual government performance, official endorsement, live integrations, actual payment, GPS tracking, or an immutable ledger without verified evidence.
- Integration statuses must be Mock, Planned, or Not connected.
- Never invent missing values. Use “Insufficient data” when metrics cannot be responsibly calculated.
- Keep physical stock separate from throughput; avoid double-counting across stages.
- Use fixed demo reference time or clearly labelled simulated time.

## 4. Non-negotiable domain invariants
- Validate business actions in domain/service logic, not only in forms.
- Rejected grading requires a reason.
- Payment becomes Paid only after explicit simulated completion.
- Stock transfer updates source and destination consistently; reject over-transfer without partial mutation.
- Retail sale decreases stock and rejects overselling without partial mutation.
- Shipment transitions follow the allowed transition table and append history.
- Traceability gaps remain visible; do not fabricate events.
- Important simulated mutations create demo audit events.
- Local storage is prototype persistence, not a security control.

## 5. Security and privacy
- Never put secrets, credentials, tokens, or real personal/financial data in source, fixtures, docs, prompts, logs, or commits.
- Do not weaken validation or tests to make a demo appear successful.
- Avoid unsafe HTML injection and validate external URLs.
- CSV exports must safely escape fields and mitigate spreadsheet formula injection.
- Frontend roles are demo-only UI permissions, not authorization.
- Do not connect external systems or send data externally without explicit authorization and a reviewed plan.

## 6. UX and accessibility
- Follow `DESIGN_SYSTEM.md` and reuse tokens/shared components.
- Use semantic HTML, accessible labels, visible keyboard focus, sufficient contrast, and statuses that do not rely on colour alone.
- Support desktop, tablet, and mobile.
- Provide loading, empty, error, and insufficient-data states.
- Avoid fake live indicators, official seals, gratuitous gradients, and decorative filler.

## 7. Verify before claiming done
Inspect configured scripts, then run relevant type-check, lint, tests, and build. Fix errors caused by the change. If a check is absent or cannot run, state that; never claim it passed. Test cross-module effects for shared-data mutations.

Final response must include:
1. What changed and files changed.
2. Commands actually run and results.
3. Checks not run and why.
4. Remaining limitations/assumptions.
5. Manual verification the user should perform.

## 8. Task execution
For a multi-stage feature: identify the stage and affected files; implement; run checks; summarize actual results/blockers; stop at the requested stage boundary. Ask one concise question only when an ambiguity blocks safe implementation. Otherwise make the smallest reversible assumption and document it.

## 9. Documentation maintenance
Update docs when behaviour, domain contracts, architecture, security posture, or test commands change. Do not rewrite the BRD to match an incomplete implementation; report implementation gaps separately.
