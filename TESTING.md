# Testing Strategy — Vayal-to-Vaasal

## 1. Goals
Verify domain correctness, shared-state consistency, truthful metrics, accessible interactions, and a reliable local demo. Use synthetic fixtures only. Inspect `package.json` before assuming a test framework or command.

## 2. Test layers
### Unit tests
Test pure functions: INR/quantity/date formatting; payment deadline/ageing and 72-hour compliance; processing yield with compatible units; inventory availability/utilisation/reconciliation; shipment delay and status transitions; farmer share using attributable payment and matching sold quantity; traceability coverage/incomplete-chain detection; target attainment; zero-denominator behaviour; CSV escaping/formula-injection mitigation.

### Domain/service tests
- Accept/reject grading updates linked records correctly; rejection requires a reason.
- Payment becomes Paid only after explicit simulated completion.
- Stock transfer reduces source and increases destination equally.
- Over-transfer fails without partial mutation.
- Retail sale decreases store stock and records one transaction.
- Overselling fails without partial mutation.
- Shipment transitions obey the transition table and append history.
- Reset restores deterministic baseline.
- Malformed or old persistence payloads do not crash the app.

### Component/integration tests
- All eleven modules navigate correctly.
- Filters update relevant KPIs, charts, and tables.
- Batch/QR search returns expected records.
- Forms show validation and actionable errors.
- Consequential actions ask for confirmation where required.
- Successful simulated mutations update dependent modules.
- Role switcher is clearly labelled as demo-only.
- Empty, error, and insufficient-data states render correctly.

### End-to-end/manual acceptance
1. Accept a procurement lot and confirm its payment obligation.
2. Record simulated payment completion and verify SLA calculations.
3. Transfer inventory and verify both warehouse balances.
4. Attempt an over-transfer and verify no balance changes.
5. Record a retail sale and verify stock/sales totals.
6. Search a batch/QR and inspect all known events and missing links.
7. Change district/commodity/date filters and verify affected displays.
8. Export CSV and inspect escaping and dangerous cell prefixes.
9. Reset demo data and verify the baseline.
10. Check keyboard navigation, visible focus, mobile/narrow layout, and non-colour status cues.

## 3. Edge cases
Empty dataset/filter; zero denominator; missing timestamps; duplicate/unknown IDs; incompatible units; invalid quantities; reserved/damaged/insufficient stock; duplicate submission; missing traceability stage; broken parent-child link; invalid shipment transition; malformed local storage; CSV commas/quotes/newlines/formula prefixes; exact 72-hour boundary and just over; missing/zero target.

## 4. Test data
Use deterministic fixtures and a fixed reference timestamp. Never use real farmer/customer/financial information. Include normal, warning, and exception records. Assert known business outcomes rather than relying on snapshots alone. Keep proposal targets separate from simulated actuals.

## 5. Commands
Inspect `package.json` and run only configured scripts. Typical commands **if present**:
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
If a script is absent, do not claim it passed; use the repository's actual equivalent or report it as not configured. Do not install a test framework without need and dependency review.

## 6. Bug report
Include summary/severity, role/preconditions, reproduction steps, expected/actual result, synthetic record IDs, relevant logs with secrets removed, and regression test status.

## 7. Release gate
- [ ] Type-check, lint, tests, and build pass (or missing checks are explicitly reported).
- [ ] Critical cross-module workflows pass.
- [ ] Inventory and retail stock invariants verified.
- [ ] Payment SLA boundaries verified.
- [ ] No unsupported live/integration/security claims.
- [ ] Responsive and keyboard smoke checks pass.
- [ ] Remaining limitations documented.
