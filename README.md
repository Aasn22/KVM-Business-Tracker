# KVM Staff Collective

Interactive Staff Café + Tuck Shop demo using Next.js App Router, TypeScript, Tailwind, generated shadcn/ui components (Base UI), and Lucide icons.

## Run

Node 24 and npm are recommended.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## Try the complete workflow

Sign in with **KV1042 / demo PIN 1234**, or choose a demo role. Available staff: Amira (KV1042, cashier), Daniel (KV2088, kitchen), Maya (KV3001, manager); Ibrahim (KV4106) can also be charged as a customer. The header role switcher clears the cart and exposes the selected role's navigation. A new shift starts on each login/role change.

1. Add a café item and choose sugar, service style and destination. Add retail stock to the same cart by selecting Tuck Shop. Search by name or exact SKU (e.g. `8901000009`). Out-of-stock items cannot be sold; checkout rechecks combined quantities across modifiers. All café items share the order destination chosen at checkout.
2. Try cash (insufficient cash is rejected, change is calculated), bank transfer (reference required), customer credit (all-time demo outstanding limit), and salary deduction (calendar-month employee limit). All four methods record demo payments only.
3. Open Kitchen Board. The seeded tickets show green/amber/red SLA states. Start preparation, mark ready, assign runner and location, dispatch and deliver. Pickup/dine-in tickets complete directly from Ready. Timers stop on completion; average prep measures creation to Ready, not delivery.
4. Switch to manager. In Purchasing choose **Café Supplies** or **Tuck Shop Stock** (mandatory), inventory item, supplier, unique supplier invoice, quantity and cost. Create the PO then mark Received. Only the chosen ledger's stock increases, once. Verify on Inventory. Café ingredient shortages never prevent food sales.
5. Reports & Ledger filters revenue, received purchasing expenses and itemized charges by Today / Monday-based This Week / calendar This Month and segment. Export filtered salary/credit lines to CSV. Account balances intentionally show all segments, all-time outstanding credit and current-month salary deductions. No repayments or payroll settlements are implemented.

All sample currency is **USD**; no tax, refunds, actual card/bank payments or statutory payroll calculations are configured. Sample stock represents current on-hand quantities (historical seeded sales are already reflected). Reporting uses the browser's local timezone; CSV dates use ISO UTC.

## Important demo limitations

- **Demo login and UI role gating are not secure authentication or server authorization.** The public demo PIN is not a credential and must not be reused for real staff.
- Data persists only in `localStorage` under `kvm-staff-pos-v1` in the current browser/origin. Reload retains records; the role switcher does not reset them. Reset demo data asks confirmation. Blocked/full storage shows an explicit warning.
- Open tabs receive storage updates, but this is **not a concurrent/multi-terminal transactional database**. Do not use for real stock, payroll, customer credit, financial records, or personal information.
- No backend, real payment processing, payroll integration, or central audit trail is included. Production use requires secure authentication, server-side authorization/validation, transactional database stock and account balances, backups and payment/payroll integrations.
- This new branch is independent of the existing market-budget tracker branch. It does not modify or promote the currently deployed production application. `vercel.json` applies Next.js build settings to this branch only.
