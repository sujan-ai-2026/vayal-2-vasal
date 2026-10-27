# Security and Data Handling — Vayal-to-Vaasal

## 1. Security posture
This is a stakeholder-facing frontend prototype using synthetic data. It is **not production-secure**. Frontend role switching is not authorization. Do not claim compliance, certification, a secure ledger, or protection of real government/farmer data without a separate reviewed implementation.

## 2. Data classification
- **Synthetic demo data:** permitted; label it clearly and use fictional identifiers.
- **Proposal/context figures:** label source and period; never present as live transactions.
- **Real personal, financial, farmer, or government operational data:** do not put in fixtures, screenshots, commits, logs, browser storage, or prompts without an approved data-handling process.
- **Secrets, tokens, credentials:** never commit or hardcode them.

Do not copy real Aadhaar numbers, bank details, phone numbers, addresses, or farmer account identifiers into demo content.

## 3. Trust boundaries
- Browser UI and local storage are user-controlled and modifiable.
- Role-based UI visibility is a demonstration only.
- Demo audit logs can be edited/deleted; they are not tamper-proof.
- Simulated “Paid” is not evidence that money moved.
- External systems must remain labelled Mock, Planned, or Not connected until authorized and verified.
- Do not claim live GPS, live APIs, ePoS, payment processing, deployment, or official endorsement without evidence.

## 4. Secure coding rules
- Never place secrets in source, committed `.env`, fixtures, docs, prompts, or logs.
- Validate and normalize inputs at service/domain boundaries.
- Render user input as text. Avoid unsafe HTML injection and `dangerouslySetInnerHTML` unless specifically reviewed and sanitized.
- Do not construct executable code from user input.
- Validate external URLs; do not invent QR destinations.
- CSV export must quote/escape fields and mitigate spreadsheet formula injection for cells beginning (after leading whitespace/control chars) with `=`, `+`, `-`, or `@`.
- Do not log sensitive values.
- Do not disable type checks, lint, validation, or tests to conceal defects.
- Keep dependencies minimal and use the repository's package manager/lockfile.

## 5. Prototype safeguards
- Show a persistent “Synthetic demo data” label.
- Distinguish proposal targets from simulated actuals.
- Use fixed demo time or a clearly labelled simulated clock.
- Explain that role permissions and audit events are demo-only.
- Reset must restore deterministic baseline.
- Do not store real credentials or personal data in local storage.

## 6. Production prerequisites — not claims about current implementation
Before production use, conduct threat modelling and review: identity/session management; server-side role and record authorization; API authentication, validation and rate limiting; encryption and key management; audit integrity/retention/monitoring; data minimization, purpose, notice/consent where applicable, retention/deletion; backups and incident response; vulnerability/dependency management; integration permissions and data-sharing agreements; and applicable Indian legal/policy requirements reviewed by qualified security/legal stakeholders.

## 7. Checklist
- [ ] No secrets or real personal data in repository.
- [ ] No unsafe HTML or unvalidated external URLs.
- [ ] Domain inputs validated; failed operations do not partially mutate state.
- [ ] CSV export is spreadsheet-safe.
- [ ] Malformed local persistence has a safe recovery path.
- [ ] Demo, target, planned, and live labels are truthful.
- [ ] UI roles are explicitly simulated.
- [ ] Dependencies are justified.
- [ ] Production use is blocked pending proper backend/security review.
