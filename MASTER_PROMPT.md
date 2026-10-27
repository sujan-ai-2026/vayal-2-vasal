# MASTER PROMPT: Vayal-to-Vaasal — Tamil Nadu Government Supply Chain Command Dashboard

## 1. Role and objective

Act as a senior product architect, government digital-transformation consultant, UX/UI designer, and senior React frontend engineer.

Build a polished, interactive web application prototype for **Vayal-to-Vaasal**, a proposed Government of Tamil Nadu agricultural supply-chain platform presented by Pirai Infotech.

The objective is to demonstrate a complete digital chain connecting farmers, procurement centres, processing facilities, warehouses, transport networks, ration shops, and cooperative retail stores.

This is a stakeholder-facing demonstration model. It must look credible in a presentation to senior government officials and be interactive enough to demonstrate real workflows.

Do not create a generic admin dashboard, landing page, static infographic, or collection of disconnected charts. Build an integrated command centre with a coherent data model and working navigation.

## 2. Business context — source of truth

Vayal-to-Vaasal proposes four connected pillars:

1. **Farm Sourcing:** Direct procurement through Primary Agricultural Cooperative Societies (PACS) and Farmer Producer Organisations (FPOs), signed buy-back contracts, farm-gate grading, agreed prices and farmer payments within 72 hours of acceptance.
2. **Processing Hubs:** Process crops into state-branded rice, edible oil and millet mixes within Tamil Nadu.
3. **Storage & Freight:** Track warehouses, inventory, dispatches, transportation, losses and batches.
4. **Direct Retail:** Distribute state-branded products through ration shops and cooperative stores, including Kamadhenu and Chintamani.

All four pillars must write to a shared digital ledger so that an executive can trace a crop lot from procurement to its final destination.

The platform is intended to connect existing systems rather than replace them, including AgriStack, PACS computers, ration-shop ePoS, e-NAM and TNCSC procurement systems.

The Government of Tamil Nadu is intended to own the platform, data and brand.

### Pilot context

- Thanjavur: rice.
- Dharmapuri or Tiruvannamalai: millets and groundnut.
- Pilot duration: one agricultural season.
- These are proposed pilot locations; the second district must remain configurable.

### Pilot targets from the proposal

- Contracted farmer income: increase by 15–25%.
- Farmer share of shelf price: at least 55%.
- Grain loss between field and shelf: reduce by 25–40%.
- Farmer payment: within 72 hours of acceptance.
- State-brand packs traceable by QR to district and batch: 100%.

These are proposed goals, not actual performance results.

The pitch also cites 64.2 lakh MT of paddy procurement/harvest for 2025–26 and approximately 35,000 ration shops. Treat these as contextual figures from the proposal, not live transactional records.

## 3. Technology requirements

Use the existing repository and its established conventions if a codebase is provided.

For a new frontend project, use:

- React with TypeScript.
- Vite or the existing application framework.
- Tailwind CSS.
- shadcn/ui where suitable.
- Recharts for charts.
- Lucide React for icons.
- React Router for page navigation when required.
- A reusable, typed mock-data/service layer.
- Local state and browser persistence for demonstrable prototype workflows where appropriate.

Do not add unnecessary dependencies or introduce a new architecture when an equivalent implementation already exists.

Build reusable components and maintain a clean separation between UI, data models, business calculations and mock services.

Do not build a production backend, connect to real government systems, or require credentials for the prototype.

## 4. Visual design direction

Create a premium, modern public-sector command centre.

Design principles:
- Desktop-first, responsive and presentation-ready.
- Forest green, warm off-white, muted agricultural green and restrained amber for warnings.
- Clear typography, strong information hierarchy and carefully aligned cards.
- Compact, useful charts and data tables.
- Subtle borders, moderate corner radii and restrained shadows.
- Realistic operational data density without visual clutter.
- Consistent spacing, readable labels and accessible contrast.
- Use Lucide icons and lightweight charts instead of excessive decorative illustrations.
- Use a Tamil Nadu map or a clean district map visualisation when practical; do not invent geographic precision.
- Use Indian currency formatting (₹), Indian number grouping and appropriate metric units.
- Display timestamps consistently using the configured demo timezone.

Avoid:
- Generic purple/blue AI dashboard styling.
- Excessive gradients, glassmorphism, oversized cards and unnecessary animations.
- Fake real-time indicators, fabricated official seals or government endorsements.
- Empty pages, non-functional buttons and meaningless placeholder charts.
- Large blocks of text where a chart, table or status indicator is more useful.

Application identity:

**Vayal-to-Vaasal**
*Tamil Nadu Agricultural Supply Chain Command Centre*

Include a persistent sidebar, compact top navigation, page title and breadcrumb, date range control, district filter, commodity filter, demo-data indicator and user/profile menu.

## 5. Application navigation

Create these routes or equivalent navigable screens:

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

All screens must share the same mock data and filtering conventions.

## 6. Executive Overview — primary screen

This is the most important page. Optimise it for a senior government official who wants to understand statewide performance at a glance.

### Header

- Dashboard title and short explanatory subtitle.
- District filter: All Pilot Districts, Thanjavur, Dharmapuri, Tiruvannamalai.
- Commodity filter: All, Paddy, Millets, Groundnut, Gingelly, Pulses.
- Date range selector.
- Last updated timestamp based on demo data.
- Visible "DEMO DATA" badge.

### KPI cards

Display:

1. Total contracted farmers.
2. Procurement accepted, in MT.
3. Procurement value, in ₹.
4. Payments completed within 72 hours, in %.
5. Pending farmer payments, in ₹ and count.
6. Current usable inventory, in MT.
7. Recorded supply-chain loss, in %.
8. QR-traceable batches, in %.

Each card should show a meaningful comparison, contextual tooltip, and click-through to the relevant detailed page.

If a valid comparison period does not exist, show "No comparison data" instead of inventing growth.

### Main visualisations

Include:

- Procurement trends by day or week.
- Procurement volume by commodity.
- District-wise operational performance.
- Payment status distribution.
- Inventory by warehouse and commodity.
- Supply-chain flow across the four pillars.
- Pilot target versus simulated actual performance.
- A recent activity feed.

### District map

Show pilot districts and their operational status where feasible.

Selecting a district must filter the relevant dashboard views. Use grounded geographic data if a map is implemented. Otherwise, use a district comparison panel instead of a misleading map.

### Executive attention panel

Show prioritised exceptions such as:

- Farmer payments approaching or exceeding 72 hours.
- Lots rejected during grading.
- Stock discrepancies.
- Delayed dispatches.
- Missing batch scans.
- Processing yield below configured expectations.
- Retail stock shortages.

Each alert must include severity, affected entity, district, age, reason and an action to open the relevant record.

Generate alerts from the mock dataset and defined business rules, not hardcoded decorative messages.

## 7. Farm Sourcing module

Build a complete procurement management view.

### Summary metrics

- Registered farmers.
- Contracted farmers.
- Active PACS and FPOs.
- Contracted quantity.
- Quantity received.
- Accepted and rejected quantity.
- Procurement value.
- Average price per kg or tonne.

### Procurement register

Include columns for:

- Lot ID.
- Farmer ID and farmer name.
- PACS/FPO.
- District.
- Commodity and crop variety.
- Contracted price.
- Received quantity.
- Accepted quantity.
- Rejected quantity.
- Grade.
- Arrival and acceptance timestamps.
- Payment status.

### Interactive features

- Search and filter records.
- Open a lot detail drawer.
- Create a simulated procurement record.
- Record grading results.
- Accept or reject a lot with a mandatory reason.
- Show a confirmation dialog for state-changing actions.
- Reflect changes in related dashboard metrics.

Model the workflow:

Contract → Farm-gate grading → Receipt → Acceptance → Payment obligation → Processing or storage.

Preserve a distinction between quantities received, accepted and rejected.

## 8. Farmer Payments module

Create a dedicated payment-monitoring screen.

Display:

- Total amount payable.
- Amount paid.
- Amount pending.
- Payments completed within 72 hours.
- Overdue payment count.
- Payment ageing distribution.

Each payment record should include:

- Payment ID.
- Farmer ID.
- Related lot ID.
- Accepted amount and payable amount.
- Acceptance timestamp.
- Due timestamp.
- Payment status.
- Payment method/reference where simulated.
- Paid timestamp.

Business rules:

- Calculate the 72-hour deadline from the lot acceptance timestamp.
- Calculate elapsed time and payment ageing.
- Differentiate pending, due soon, overdue, paid and failed.
- A payment is compliant only if completed within 72 hours of acceptance.
- Use explicit date/time handling.
- Allow a simulated payment status update.
- Update executive KPIs and audit history consistently.

Do not label a payment successful merely because it was initiated.

## 9. Processing Hubs module

Create a processing-facility overview and register.

Display:

- Facility name and location.
- Supported commodities.
- Daily processing capacity.
- Input quantity.
- Output quantity.
- Processing yield.
- Recorded processing loss.
- Production status.
- Input and output batch references.

Support demo products such as:

- State-branded rice.
- Gingelly or groundnut oil.
- Millet mixes.

Define yield as accepted output quantity divided by input quantity for comparable units. Distinguish processing loss from transport loss and storage loss.

Provide a facility detail view with production batches, recent activity and input/output reconciliation.

Facility capacities and operating values must be explicitly simulated.

## 10. Storage & Inventory module

Build a warehouse management overview.

### Inventory summary

- Total stock.
- Usable stock.
- Reserved stock.
- Damaged stock.
- Ageing stock.
- Stock by commodity and district.

### Warehouse register

Include:

- Warehouse ID and name.
- District and location.
- Capacity and utilised capacity.
- Commodity and batch.
- Quantity on hand.
- Reserved and damaged quantity.
- Last stock update.
- Stock discrepancy status.

Support inventory detail drawers and a stock movement history.

A stock transfer must reduce stock at the source and increase stock at the destination consistently. Prevent transfers beyond available stock.

Never allow the same quantity to be counted twice when stock moves between facilities.

## 11. Freight & Logistics module

Create a logistics monitoring screen.

Track:

- Shipment ID.
- Origin and destination.
- Related batch IDs.
- Commodity.
- Dispatch quantity.
- Vehicle or carrier reference.
- Dispatch timestamp.
- Expected arrival.
- Actual arrival.
- Shipment status.
- Recorded loss or discrepancy.

Provide statuses such as Planned, Dispatched, In Transit, Delivered, Delayed and Exception.

Include a shipment timeline and a simple route visualisation if feasible.

Allow simulated status changes. Validate transitions and maintain a history of changes.

Flag overdue deliveries based on the expected arrival timestamp.

Do not claim actual GPS tracking. Use a clearly labelled simulated route and movement status.

## 12. Direct Retail & Sales module

Create a retail distribution and sales dashboard.

Include:

- Participating ration shops and cooperative stores.
- State-brand stock availability.
- Product-wise sales.
- Retail inventory.
- Replenishment requirements.
- Retail selling price.
- Farmer share of shelf price.
- District-wise sales performance.

Retail records should reference a product batch and a store.

Implement a sales transaction that reduces store inventory and increases recorded sales. Validate available stock.

### Farmer share calculation

Where the data supports a meaningful comparison:

Farmer share (%) = farmer payment attributable to the sold quantity ÷ corresponding retail shelf value × 100.

Clearly document assumptions for processing costs, packaging, transport, taxes and unsold stock. Do not compare unrelated crop and product quantities.

Display the proposal's 55% minimum as a target, not a guaranteed outcome.

## 13. Batch Traceability module

Build a visually compelling, searchable end-to-end batch tracking experience.

Allow users to search by:

- Batch ID.
- QR identifier.
- Procurement lot.
- Commodity.
- District.
- Product batch.

The detail page must show a chronological chain:

Farmer → PACS/FPO → Grading and acceptance → Processing → Warehouse receipt → Shipment → Destination warehouse or store → Retail sale, where available.

At every stage, show:

- Event ID.
- Timestamp.
- Responsible organisation.
- Location.
- Input and output quantities.
- Related batch IDs.
- Status.
- Supporting reference.
- Recorded discrepancy, if any.

Support split and merged batches. Maintain parent-child batch relationships when raw produce becomes multiple processed products or when shipments split.

Create a working demo QR-code scan/search flow. A generated QR code must resolve to the same batch detail page as manual search.

Do not represent a missing event as verified traceability. Clearly flag incomplete chains and missing scans.

## 14. District Performance module

Provide a district comparison view for the configurable pilot districts.

Compare:

- Contracted farmers.
- Procurement volume.
- Procurement value.
- Payment compliance.
- Inventory.
- Processing throughput.
- Loss rates.
- Shipment delays.
- Retail distribution.
- QR traceability.
- Pilot target progress.

Allow sorting, filtering, drill-down and export of the filtered table to CSV.

Use district-level aggregated records consistent with the underlying entities.

Do not imply that every district is participating in the pilot.

## 15. Reports & Audit Log

Provide report views for:

- Procurement summary.
- Farmer payment compliance.
- Inventory and stock movement.
- Processing and loss reconciliation.
- Freight performance.
- Retail sales.
- Traceability coverage.
- District pilot performance.

Support date and district filters, CSV export and a print-friendly report view.

The audit log should record simulated actions with:

- Event ID.
- Timestamp.
- Demo user and role.
- Action performed.
- Entity and record ID.
- Previous and new values where applicable.
- Reason or note.

Label this as a prototype audit trail. Do not claim immutable storage, cryptographic verification or regulatory certification.

## 16. Settings & Data Sources

Create a settings screen showing proposed integration points for:

- AgriStack.
- PACS systems.
- e-NAM.
- TNCSC procurement.
- Ration-shop ePoS.
- Warehouse and freight systems.

For each integration, show:

- Purpose.
- Expected data.
- Mock connection status.
- Last simulated sync.
- Example failure or validation state.

Every connection must be marked "Mock", "Planned" or "Not connected". Never fabricate a successful live integration.

Include configurable district scope, commodity list, payment SLA and target settings for demonstration purposes.

## 17. Data model and consistency

Create strongly typed entities and relationships for:

- District
- Farmer
- PACS/FPO
- Buy-back contract
- Procurement lot
- Grade assessment
- Farmer payment
- Processing facility
- Processing batch
- Warehouse
- Inventory balance
- Stock movement
- Shipment
- Retail store
- Product
- Sales transaction
- Traceability event
- Demo user
- Audit event

Use stable IDs and referential integrity.

Use a shared mock-data service rather than maintaining unrelated hardcoded arrays on each screen.

Generate a realistic, deterministic dataset covering both rice and non-paddy crops, multiple districts, several facilities, warehouses, stores, paid and unpaid farmer lots, shipments, and complete and incomplete traceability chains.

Include normal cases, warning cases and exception cases.

Use a fixed reference timestamp for deterministic demo calculations, or provide a clearly labelled simulated-time control.

All dashboard aggregates must derive from the same underlying records.

## 18. Data integrity and calculations

Implement reusable calculation functions for:

- Procurement quantity and value.
- Payment ageing and 72-hour compliance.
- Inventory reconciliation.
- Warehouse utilisation.
- Processing yield.
- Freight delay.
- Recorded loss by stage.
- Farmer share of shelf price.
- QR traceability coverage.
- Target attainment.

Use consistent units and denominators.

For each metric, expose a tooltip or definition explaining the formula, scope, time period and data status.

Avoid double-counting batches across multiple stages. Distinguish physical stock from cumulative throughput.

Handle empty states, zero denominators, missing timestamps and incomplete records gracefully.

Where a KPI cannot be calculated reliably, display "Insufficient data" instead of manufacturing a value.

## 19. User roles and access

Demonstrate four roles:

1. State executive — statewide overview, district comparisons, reports and exceptions.
2. District officer — district-specific operational views.
3. Procurement officer — contracts, grading, lots and payment obligations.
4. Warehouse operator — inventory, stock movements and shipments.

Provide a role-switcher for demonstration.

Use role-based visibility and action permissions in the frontend. Clearly explain that these are simulated UI permissions, not production security.

## 20. UX and interactions

Every visible primary control must work.

Implement:

- Sidebar routing and active states.
- Global search where appropriate.
- District, commodity and date filters.
- Sortable and searchable tables.
- Pagination for large registers.
- Detail drawers or modal panels.
- Create/edit workflows for appropriate demo entities.
- Confirmation dialogs for consequential actions.
- Form validation and useful error messages.
- Toast feedback.
- Empty, loading and error states.
- CSV export.
- Working QR/batch search.
- Cross-page updates after successful simulated mutations.
- Audit event creation for important state changes.

Filters must actually affect the relevant data. Charts should update when their underlying scope changes.

Persist prototype mutations locally where feasible and include a clearly labelled "Reset demo data" action that restores the deterministic baseline.

## 21. Accessibility and responsive behaviour

- Use semantic HTML and accessible form labels.
- Support keyboard navigation.
- Provide visible focus indicators.
- Maintain adequate colour contrast.
- Do not rely on colour alone for statuses.
- Include responsive layouts for desktop, tablet and mobile.
- Keep operational tables readable on narrow screens.
- Use concise, human-readable date, number and currency formatting.

## 22. Non-negotiable integrity rules

- Do not fabricate actual Government of Tamil Nadu performance.
- Do not imply the proposed platform is already deployed.
- Mark all generated transactional records as synthetic demo data.
- Distinguish proposal targets from simulated actuals.
- Do not present contextual statistics from the pitch as live metrics.
- Do not invent official API endpoints, credentials, integration confirmations or government endorsements.
- Do not claim production-grade security or a real immutable ledger.
- Do not silently resolve missing requirements by inventing business rules.
- Document assumptions in a small "Demo assumptions & metric definitions" panel.
- Keep the architecture ready for a future backend/API integration.

## 23. Deliverable and acceptance criteria

Produce a runnable, polished frontend prototype with:

1. A complete application shell and working navigation.
2. All 11 modules implemented with meaningful content.
3. A highly polished Executive Overview.
4. Shared, deterministic mock data and consistent calculations.
5. Functional procurement, payment, inventory and shipment interactions.
6. A batch traceability view with a working QR/search demonstration.
7. Configurable pilot districts and operational filters.
8. A clear distinction between simulated actuals and pilot targets.
9. Useful empty states, alerts, validation and error handling.
10. Responsive design and accessible controls.
11. CSV exports and a demo reset function.
12. Clear instructions to run the application locally.

Before completion, test the key workflows and fix console errors, broken routes, inconsistent totals, dead buttons and invalid state transitions.

Start by inspecting the repository if one exists. Then establish the shared data model, mock dataset, application shell and primary dashboard before implementing the remaining modules.

Prioritise a coherent end-to-end demonstration over decorative complexity. The final product should allow a government stakeholder to follow one batch from a farmer's field to a retail destination and understand how the same data supports statewide decisions.