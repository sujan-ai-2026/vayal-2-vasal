# Business Requirements Document (BRD)
## Vayal-to-Vaasal — Tamil Nadu Agricultural Supply Chain Command Centre

**Status:** Stakeholder-facing prototype baseline. **Version:** 1.0.  
**Boundary:** Proposed platform concept; not a deployed or officially endorsed government system.

## 1. Purpose and objectives
Demonstrate an integrated chain connecting farmers, PACS/FPO procurement, processing hubs, warehouses, freight, ration shops, and cooperative retail stores. The prototype must let stakeholders follow a crop lot from acceptance through processing and distribution to retail, using coherent shared demo records.

Objectives:
- Demonstrate direct procurement, grading, agreed prices, and the proposed 72-hour farmer-payment SLA.
- Track processing output/yield, inventory, transfers, shipments, retail stock, sales, and stage-specific losses.
- Provide a command-centre overview with useful district, commodity, date, and status filters.
- Keep prototype data coherent, calculations defined, and important demo actions auditable.
- Prepare a clean seam for future API integration without pretending integrations exist.

## 2. Business context and assumptions
Four pillars: Farm Sourcing; Processing Hubs; Storage & Freight; Direct Retail.
Proposed pilot: Thanjavur for rice and Dharmapuri or Tiruvannamalai for millets/groundnut, over one agricultural season. The second district must remain configurable.
Proposal targets: contracted farmer income +15–25%; farmer share of shelf price at least 55%; field-to-shelf grain loss reduced 25–40%; payment within 72 hours of acceptance; QR traceability for 100% of state-brand packs. These are **targets, not observed results**.
The proposal references 64.2 lakh MT paddy procurement/harvest for 2025–26 and approximately 35,000 ration shops. If shown, label these as contextual proposal figures, not live transaction records.

## 3. Users and demo roles
| Role | Main needs |
|---|---|
| State executive | Statewide KPIs, district comparisons, reports, exceptions |
| District officer | District operations and performance |
| Procurement officer | Contracts, lots, grading, payment obligations |
| Warehouse operator | Inventory, stock transfers, shipments |

Role switching only changes demo UI visibility; it is not authorization or production security.

## 4. Scope
### In scope
React + TypeScript frontend using the existing repository conventions; deterministic synthetic demo data; shared typed models and mock services; local prototype persistence and reset; all eleven modules:
1. Executive Overview
2. Farm Sourcing
3. Farmer Payments
4. Processing Hubs
5. Storage & Inventory
6. Freight & Logistics
7. Direct Retail & Sales
8. Batch Traceability
9. District Performance
10. Reports & Audit Log
11. Settings & Data Sources

Include filters, searchable/sortable/paginated registers where appropriate, details, forms, validation, confirmations, toasts, CSV export, role switcher, traceability/QR search, responsive and accessible layouts.

### Out of scope
Production backend, real government data, credentials, live integrations, real payments, live GPS, production authentication/authorization, immutable ledger, or claims of official endorsement/deployment.

## 5. Functional requirements
- **Overview:** KPIs for contracted farmers, accepted procurement quantity/value, 72-hour payment compliance, pending payments, usable inventory, recorded losses, QR coverage; charts, alerts, activity, target-vs-simulated-actual.
- **Farm sourcing:** farmer, PACS/FPO, contract, lot, district, commodity, quantity, grade, price, assessment; accept/reject grading, mandatory rejection reason.
- **Payments:** link to accepted lot; deadline = acceptance timestamp + configured SLA; distinguish pending, due soon, overdue, paid, failed. Initiation alone never means Paid.
- **Processing:** facilities, input/output batches, yield and processing loss. Yield = accepted output / input using comparable units.
- **Inventory:** warehouse capacity, balances, usable/reserved/damaged/ageing stock, discrepancies and movement history. Transfers reduce source and increase destination consistently; block over-transfer; no double-counting.
- **Logistics:** shipment origin/destination, batch, quantity, carrier reference, timestamps, status, discrepancy; validated transitions among Planned, Dispatched, In Transit, Delivered, Delayed, Exception; history and overdue flags. No live GPS claim.
- **Retail:** store/product/batch stock, price, sales, replenishment; sale decrements stock; block overselling.
- **Traceability:** search batch/QR/lot/product/district/commodity; chronological farmer → PACS/FPO → grading → processing → warehouse → shipment → destination → retail chain. Show missing links as gaps; support parent-child batches.
- **Districts/reports/settings:** comparisons, CSV/print-friendly reports, demo audit log, configurable districts/commodities/SLA/targets, integration registry.
- **Integrations:** AgriStack, PACS systems, e-NAM, TNCSC procurement, ration-shop ePoS, warehouse/freight systems must be marked Mock, Planned, or Not connected.
- **Shared data:** stable IDs, referential integrity, deterministic fixtures with normal/warning/exception cases, shared calculations, local persistence, reset.

## 6. Business rules and metric definitions
- **72-hour compliance:** eligible payments completed within SLA divided by eligible accepted lots/payments in the chosen scope; expose denominator and period.
- **Farmer share:** farmer payment attributable to sold quantity / corresponding retail shelf value × 100. Document assumptions for processing, packaging, transport, taxes, and unsold stock. Never compare unrelated quantities.
- **Traceability coverage:** eligible packs/batches with required chain / eligible packs/batches; define eligibility and completeness.
- **Warehouse utilisation:** occupied quantity / stated capacity with compatible units.
- **Loss:** distinguish processing, storage, and transport; never count one physical loss twice.
- **Target attainment:** compare simulated actual to separately stored proposal target.
- If denominator is zero, units incompatible, timestamps missing, or records incomplete, show “Insufficient data” or explicitly scoped partial data. Never manufacture a metric.
- Distinguish physical stock from cumulative throughput and stock in transit.

## 7. Non-functional requirements
Maintainable React + TypeScript structure; responsive desktop/tablet/mobile; semantic and keyboard-accessible UI; sufficient contrast; shared formatters; clear empty/error states; minimal justified dependencies; future API integration seam.

## 8. Acceptance criteria
- [ ] All eleven modules are navigable and meaningful.
- [ ] KPIs/charts derive from shared records and respond to filters.
- [ ] Grading and payment links are consistent.
- [ ] Inventory transfer reconciles both ends and blocks insufficient stock.
- [ ] Retail sale decrements stock and blocks overselling.
- [ ] Shipment transitions validate and record history.
- [ ] Batch/QR search shows complete and incomplete chains accurately.
- [ ] CSV export and reset work; persistence is clearly prototype-only.
- [ ] No unsupported live-data, GPS, integration, deployment, endorsement, or security claims.
- [ ] Type-check, lint, tests, and build pass, or unavailable checks are explicitly reported.
