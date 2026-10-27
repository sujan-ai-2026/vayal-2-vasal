# Application requirements review

## Acceptance pass verification

- The documented `pnpm dev` command started Vite successfully at `http://localhost:5173/`; an HTTP HEAD request returned `200 OK`.
- Browser navigation reached all 11 modules. Each rendered its expected page heading and substantive module content.
- Executive Overview district and commodity filters changed scoped totals and generated-alert counts. The fixed dataset includes an older procurement/payment record so the date-range control also has observable effect: season-to-date accepted quantity was 6.85 MT versus 4.50 MT for the last seven days, and generated alerts changed from 15 to 14.
- Procurement lot receipt created a shared synthetic lot. Partial acceptance with a recorded rejection reason created a linked pending payment with acceptance and 72-hour due timestamps. On a fresh lot, the rejection reason field was required and invalid while blank; the shared service also rejects missing reasons.
- Payment register displayed acceptance, due time, elapsed age and 72-hour compliance from the acceptance timestamp. Example paid records showed elapsed hours within SLA; pending and failed obligations remained separate.
- A 2,000 kg inventory transfer against 1,290 kg usable stock was blocked. A 10 kg transfer reduced source balance by 10 kg, increased destination balance by 10 kg, and wrote a movement, traceability event and audit record.
- The Dharmapuri warehouse demo role can access the delayed Dharmapuri shipment workflow. Changing it to In Transit produced a status-history event and audit record; the shipment remained correctly flagged overdue against its expected arrival timestamp.
- A retail sale reduced store inventory from 88 to 87 units and updated sales records. An attempted sale above available inventory was rejected.
- Procurement and warehouse role switches changed visible routes, locked district scope and exposed only the intended demo actions. The profile explicitly identifies permissions as simulated frontend-only behavior.
- Global search for a shipment opened its linked traceability batch. Manual batch search and a generated demo QR identifier opened the same product-batch detail. An incomplete batch showed its missing scan; an unknown QR returned an explicit no-match message.
- Settings changed the configurable second district to Tiruvannamalai, updated the global district options and persisted after reload.
- A filtered report CSV was captured from the generated browser Blob and contained only the matching filtered row. The filtered prototype audit trail included the retail sale event in Thanjavur after resolving the sale transaction back to its store district.
- Reset cleared saved mutations, settings and role, restoring the state-executive role and baseline KPI values (5 contracted farmers; 6.85 MT accepted).
- `pnpm build` runs TypeScript project checking (`tsc -b`) and Vite production build. `pnpm lint` runs ESLint. There is no configured automated test script.

## Files changed during acceptance

- `src/components/FarmSourcing.tsx` and `src/services/mockDataService.ts`: require an explicit rejection reason in the form and shared mutation service.
- `src/components/ReportsAudit.tsx`: resolve retail-sale audit records to their store district for district filtering.
- `src/data/mockData.ts`: place a linked synthetic paddy lot/payment outside the seven-day window and scope the warehouse demo operator to Dharmapuri, where the delayed demo shipment can be updated.
- This document records acceptance checks and remaining limitations.

## Known gaps and prototype limitations

- `package.json` does not define an automated test or standalone type-check script. TypeScript is checked by the `tsc -b` step in `pnpm build`; this review used browser interactions, not an automated regression suite.
- Create/edit workflows are intentionally limited to the implemented operational actions (such as lot receipt/grading, payment completion, shipment status, stock transfer, retail sale and demo settings). There is no complete CRUD workflow for master/reference records such as farmers, PACS/FPOs, contracts, facilities, stores or products.
- Table sorting and pagination are concentrated in the oversight/report views. Small synthetic operational registers do not all provide independent sorting or pagination controls.
- The operational browser pass exercised representative filtered exports; not every report/export combination was individually checked.
- High-impact primary controls were exercised, but this was not an exhaustive click-through of every visible control on every module.
- Data and simulated permissions remain frontend-only and browser-local. There is no backend, production authorization, live integration, GPS tracking, cryptographic verification or immutable audit storage.

All records are synthetic. Government ownership is a proposal intention only; this prototype does not represent government deployment, endorsement or live data.
