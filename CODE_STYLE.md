# Code Style and Engineering Conventions — Vayal-to-Vaasal

## 1. Follow the repository first
Inspect `package.json`, TypeScript config, lint/format config, routing, styles, state management, and existing components before editing. Reuse the installed stack and patterns. Do not replace working configuration or migrate frameworks unless requested.

## 2. TypeScript
- Keep strictness enabled where supported.
- Avoid `any`; use explicit types, discriminated unions, generics, and `unknown` with narrowing.
- Define shared domain types once and use finite status unions/enums.
- Use stable IDs, explicit relationships, and intentional nullable/optional fields.
- Keep business formulas pure and typed.
- Represent quantity units explicitly; avoid unsafe non-null assertions.

## 3. React
- Use function components/hooks consistent with the repo.
- Keep components focused and extract repeated patterns where reuse is real.
- Keep business calculations and mutations out of JSX.
- Use stable list keys; avoid unnecessary effects and effect-driven derived state.
- Do not duplicate shared business records in page-local state.
- Keep transient form state local; commit valid changes through the shared service.
- Every primary control must perform a real, testable action.

## 4. Naming
- Components/types: `PascalCase`.
- Variables/functions/hooks: `camelCase`; custom hooks start with `use`.
- True module constants: `UPPER_SNAKE_CASE`.
- Follow existing file naming; otherwise components `PascalCase.tsx`, utilities/services `camelCase.ts`.
- Prefer precise business names (`acceptedQuantity`, `acceptanceAt`, `expectedArrivalAt`) over vague names.

## 5. UI and styling
- Reuse semantic HTML and current design-system primitives.
- Reuse shared buttons, inputs, tables, dialogs, status chips, formatters, and layout components.
- Use design tokens; avoid scattered arbitrary colours/spacing.
- Do not add a component library if an equivalent is already installed.
- Use Lucide React if present; do not replace operational icons with emoji.
- Ensure responsive and keyboard-accessible UI.

## 6. Data and business logic
- Use one shared service/repository for demo records.
- Fixtures must be deterministic and labelled synthetic.
- Validate at service/domain boundaries.
- Transfer and sale mutations must be atomic from the user's perspective.
- Keep physical stock distinct from throughput and stage-specific losses.
- Never invent values to complete charts.
- Use shared formatters for INR, units, dates, and percentages.

## 7. Errors and dependencies
- Provide loading, empty, error, and insufficient-data states.
- Show actionable validation; do not swallow exceptions silently.
- Do not report success before an operation succeeds.
- Check installed dependencies before adding new ones; explain material additions.
- Use the existing package manager and lockfile.
- Avoid unrelated refactors and generated artifacts in feature work.

## 8. Change workflow
1. Inspect relevant files and current diff.
2. Choose the smallest coherent change.
3. State assumptions only when they materially affect behaviour.
4. Implement the change, not just a plan.
5. Run available type-check, lint, tests, and build.
6. Fix errors caused by the change.
7. Report files changed, actual checks/results, tests not run, and limitations.
8. Update docs when behaviour or architecture changes.

## 9. Definition of done
Code is not complete merely because it was written. It must pass relevant configured checks, preserve domain invariants, maintain accessible behaviour, and report every check that could not be run.
