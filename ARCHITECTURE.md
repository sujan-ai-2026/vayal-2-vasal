# Architecture — Vayal-to-Vaasal

## 1. Goals and boundary
Use the existing repository and conventions. The intended deliverable is a React + TypeScript + Vite frontend prototype with synthetic data, local demo interactions, and no credentials/backend requirement. Tailwind, shadcn/ui, Recharts, Lucide React, and React Router are options only where suitable; inspect dependencies before adding them.

Unless explicitly implemented and reviewed, there is no production API, database, authentication provider, payment gateway, live government integration, GPS, immutable ledger, or server-side authorization.

## 2. Recommended logical structure
Adapt this to the actual repository rather than moving files mechanically:
```text
src/
  app/                 # app composition, routing, providers, shell
  components/          # shared tables, status, filters, dialogs
  features/
    overview/ farm-sourcing/ farmer-payments/ processing/
    inventory/ logistics/ retail/ traceability/
    district-performance/ reports-audit/ settings/
  domain/
    models.ts          # shared entities, IDs, status unions
    calculations.ts    # pure formulas and metric definitions
    invariants.ts      # validation and transition rules
  services/
    demoData.ts        # deterministic baseline
    mockRepository.ts  # shared read/write interface
    persistence.ts     # versioned local persistence/reset
  lib/                 # formatters, constants, CSV helpers
  test/
```
Keep existing sensible architecture. Avoid giant single-file screens and abstractions without a real use.

## 3. Domain model
Use stable string IDs, explicit relationships, ISO timestamps, and explicit units. Required concepts: District, Farmer, PACS/FPO, buy-back contract, procurement lot, grade assessment, farmer payment, processing facility/batch, warehouse, inventory balance, stock movement, shipment/status history, retail store, product, sales transaction, traceability event and parent/child batch links, demo user/role, audit event.

Use finite status unions/enums; avoid `any`. Missing values must be explicitly optional/nullable rather than silently defaulted.

## 4. Data flow
```text
Feature UI -> action handler/hook -> typed mock repository
                                 -> domain validation/pure calculations
                                 -> shared in-memory state
                                 -> versioned browser persistence (demo only)
Shared updated state -> every dependent view refreshes
```
Do not keep independent copies of business records in each screen. Derive dashboard values through shared selectors/calculations. Reuse the repository's existing state management; add a library only when a concrete need justifies it.

## 5. Invariants
- A procurement lot references a valid farmer and PACS/FPO.
- Payment references an accepted lot and has explicit amount/status/timestamps.
- SLA deadline = acceptance timestamp + configured hours; missing acceptance time is not guessed.
- Processing units must be compatible before calculating yield.
- Stock transfer validates available quantity and updates source/destination as one logical operation.
- Stock in transit is not counted as usable stock at both ends.
- A sale references a valid store/product/batch; stock cannot fall below zero.
- Shipment status transitions follow a transition table and append history.
- Missing traceability stages are shown as gaps, not fabricated events.
- Split/merge batches preserve parent-child links and quantity reconciliation when supported.
- Important simulated mutations append a demo audit event.

## 6. Determinism and persistence
- Use deterministic fixtures or a fixed seed.
- Use a fixed reference timestamp or a clearly labelled simulated clock.
- Persist mutations under a versioned key; validate parsed data defensively.
- Invalid/old stored state should recover safely to baseline and show a useful message where appropriate.
- Reset restores deterministic baseline and clears relevant prototype state.
- Never store secrets or real personal data in browser storage. Local storage is not secure or tamper-proof.

## 7. Calculations and errors
Keep pure, typed, unit-aware functions for procurement quantity/value, payment ageing/SLA, inventory reconciliation/utilisation, processing yield, shipment delay, stage-specific losses, farmer share, traceability coverage, and target attainment. Each metric needs scope, period, formula/denominator, and source-data status. Use “Insufficient data” when zero denominators or incomplete/incompatible inputs make a metric unreliable.

Validate at the service/domain boundary. Failed transfers/sales must not partially mutate state. Return typed results or use domain errors consistently with existing conventions. Handle malformed persistence without crashing.

## 8. Future integration seam
If a backend is approved, put an API-backed repository behind the application-facing interface and validate domain contracts against real schemas. Define authentication, authorization, privacy, retention, audit, availability, and data-sharing requirements first. Use authorized, documented endpoints only; never invent API URLs or label planned connections as live.

## 9. Decision rules
Before adding a dependency/pattern, explain the problem it solves and check the repository. Update this document when actual architecture materially changes.
