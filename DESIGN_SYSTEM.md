# Design System — Vayal-to-Vaasal

## 1. Product character
Premium, credible public-sector agricultural operations command centre: calm, precise, operational, data-dense, accessible. The UI is a proposal/demo, not an official government portal. Prefer clarity over decoration and useful data density over oversized cards.

## 2. Tokens
Use CSS variables or the existing token system; do not scatter raw colours through components. Proposed starting palette:
| Token | Value | Use |
|---|---|---|
| `--color-forest-900` | `#163C2C` | Deep navigation/emphasis |
| `--color-forest-800` | `#20523B` | Primary actions |
| `--color-agri-700` | `#3F7655` | Secondary emphasis |
| `--color-agri-200` | `#DCE9DE` | Soft positive surface |
| `--color-cream-50` | `#FAF9F5` | App background |
| `--color-surface` | `#FFFFFF` | Cards/dialogs |
| `--color-text` | `#202A24` | Primary text |
| `--color-text-muted` | `#647067` | Supporting text |
| `--color-border` | `#E1E6E0` | Dividers |
| `--color-amber-700` | `#98620D` | Warnings |
| `--color-amber-100` | `#FFF0C7` | Warning surface |
| `--color-danger-700` | `#B42318` | Errors/destructive |
| `--color-danger-100` | `#FEE4E2` | Error surface |

Verify contrast in implementation; do not assume tokens automatically meet WCAG. Status must never rely on colour alone.

## 3. Typography and layout
- Reuse the existing font stack unless there is a clear reason to change it.
- Use a consistent hierarchy for page title, section title, card title, body, metadata, and KPI values.
- Use tabular numerals for aligned quantities/currency where available.
- Use a persistent sidebar, compact top bar, title/breadcrumb, scope filters, demo-data indicator, and role/profile menu.
- Use a consistent spacing scale (e.g. 4, 8, 12, 16, 24, 32, 40 px), subtle borders, moderate radii, restrained shadows.
- Align card edges, chart/table baselines, and paddings. Responsive grid; stack panels on narrow screens.

## 4. Component rules
- **Navigation:** active route is obvious; no dead links.
- **KPI cards:** label, value, unit/context, comparison only when supported, definition for non-obvious metrics; label synthetic/demo values and distinguish target from simulated actual.
- **Tables:** semantic headers, consistent density, right-aligned numeric columns, status text, search/sort/pagination where needed, empty/loading/error states, keyboard-operable actions. Keep narrow-screen data discoverable.
- **Statuses:** use explicit labels (Pending, Due soon, Overdue, Paid, Failed, In transit, Delivered, Exception, Mock, Planned, Not connected). Colour is supplementary.
- **Forms/dialogs:** associated labels, actionable field errors, confirmation for consequential actions, keyboard-accessible focus handling.
- **Charts:** title, units, period, axes/legend, readable tooltip and accessible text/table equivalent for essential data. Empty/insufficient data must be explained; filters must update charts.
- **Notifications:** confirm only successful simulated actions; explain errors and recovery. Important persistent messages must not exist only in a toast.

## 5. Data formatting
- Currency: INR with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` or existing shared formatter.
- Use Indian number grouping; label lakh/crore abbreviations clearly.
- Show units (`kg`, `MT`, litres, packs); never aggregate incompatible units.
- Use one date/time formatter and configured demo timezone.
- Percentages need a clear definition/scope/period.
- Missing/unreliable metrics display “Insufficient data”; zero is reserved for true zero.
- Maintain a visible “Synthetic demo data” indicator.

## 6. Interaction and accessibility
- Use clear action labels (“Accept lot”, “Record sale”, “Transfer stock”).
- Disable invalid actions and explain why.
- Provide hover, focus, pressed, disabled, and error states; respect reduced-motion preferences.
- Target WCAG 2.2 AA as an engineering goal, not a certification claim.
- Use semantic landmarks/headings, visible focus, sufficient contrast, keyboard access, accessible dialogs, meaningful alt text, and non-colour status cues.
- Avoid fake live pulses, excessive gradients, glassmorphism, fabricated seals, unnecessary animations, and generic purple/blue AI dashboard styling.

## 7. Review checklist
- [ ] Consistent with other modules and shared tokens.
- [ ] Scope, units, period, and demo status are clear.
- [ ] Target values differ visually and textually from simulated actuals.
- [ ] Colour is not the only status cue.
- [ ] Keyboard/focus and narrow viewport are usable.
- [ ] Empty/error/insufficient-data states exist.
- [ ] Charts reflect shared filtered data.
- [ ] No unsupported live or official claims.
