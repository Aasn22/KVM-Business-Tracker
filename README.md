# CALM BREAK - KUDA VILLINGILI

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

## Staff self-service portal and mixed-order fulfillment

Open **`/staff`** (also linked on the operator login and header). Use any listed staff ID, e.g. **KV4106**, with public demo PIN **1234**. The portal is a staff-as-customer experience; public customer registration is not provided.

- Café and Tuck Shop catalogs appear together, with a shared cart, delivery destination, and one demo bill charged to the signed-in employee's credit or salary account. The portal does not permit choosing another employee to charge. Limits and retail stock are checked before the order is committed. Quantities with matching modifiers merge; different café modifiers remain separate lines.
- In the operator system, **Orders & Dispatch** shows the entire combined portal order under one order number. Kitchen operators manage café lines; shop cashiers manage retail lines; managers can manage both. Every line follows Queued → Preparing → Ready → Dispatched → Delivered with its own runner and timestamps. A line action delivers all units on that line, not a subset of its quantity.
- Shop lines may be delivered before café food is ready. The order is **Partially delivered** until all lines are Delivered, then automatically **Completed**. A separate legacy café ticket is not created for a portal sale, avoiding duplicate fulfillment. Existing counter POS café tickets remain on Kitchen Board, which links to the staff portal queue.
- Item SLA: green under 10 minutes; warning from 10 through 15 minutes; over 15 minutes escalates unfinished items to the manager queue and global manager alert. The original order creation time drives the SLA; state changes never reset it. Manager acknowledgment records their ID, time and customer-visible follow-up, but does not resolve an unfinished order. Delivery stops that item's escalation.
- **My orders** shows each line's live progress, delivery runner/time and manager follow-up. **My account & bills** shows only charges to that demo employee, account limits/balances, itemized bills, and downloadable bill CSVs. Reports include portal charges and completed café preparation timing.

**This remains a browser-local prototype, not a real online ordering service.** To demonstrate the complete loop, open `/staff` and `/` in separate tabs on the **same deployment origin in the same browser**. Orders and updates sync through browser storage. Another phone/browser/device cannot send an order to this demo's operator queue. There is no secure server session, shared transactional database, background SLA worker, push/email/SMS delivery, or real payment integration. Manager alerts are derived when the app is open or reopened; no background messages are sent. Do not use real staff/customer financial or personal data. Cross-device online service requires an authenticated backend, database transactions and a notification channel chosen and configured before production use.

Existing saved v1 demo data is preserved; the new customer-order collection is optional until the first portal order. Use Reset demo data only if you want to discard all existing local records.

## CALM BREAK - KUDA VILLINGILI update

Both operator `/` and staff `/staff` interfaces now use the CALM BREAK identity, a consistent resort-green design, and the **same local-store implementation** (not two separate hook implementations). Local writes notify subscribers and same-origin tabs; focus reloads the latest saved record. A changed persisted baseline rejects an observed stale write rather than silently replacing it. Failed storage writes are not reported as saved. This is still not an atomic multi-device database: simultaneous writes in separate tabs can race, and different origins/devices never share localStorage.

### Staff improvements

- Overview cards for open orders, salary allowance and allergy declaration.
- **My profile & allergies**: explicitly choose Not provided / No known allergies / Allergies declared, select allergens and add notes. No provided data is never presented as allergy-free. Use fictional test data only.
- The combined cart previews the allergy note that will accompany checkout. New bills and order tickets capture an immutable declaration snapshot. Bills/CSV exports do **not** include allergy health notes.
- Reorder previous mixed orders at current catalog prices with stock checks. Checkout is never automatic; destination, account and current allergy notes must be reviewed.

### Operator improvements

- Dispatch summary for active/partial/overdue orders and allergy reviews; search by order, employee/name or destination; filter pending café/shop work.
- Every portal order shows the original allergy note. If a profile changes while an order is active, the current declaration is separately flagged **UPDATED AFTER ORDER** without rewriting the historical note.
- Declared allergy orders require operator acknowledgment of the current profile revision before preparation or dispatch. Updating the profile invalidates the previous review. Clearing a declaration after ordering also requires re-review. Completed-order snapshots are preserved.
- POS checkout has an explicit staff-customer selector (unidentified by default), including for cash/bank orders. Identified orders capture their allergy note and staff ID; kitchen tickets show current profile updates and historical completion notes. Legacy orders without identified staff must prompt staff to ask about allergies.

**Safety:** This is staff-reported information, not ingredient matching or a guarantee of safe food. Review ingredients and cross-contact procedures directly with staff. Do not enter real medical/allergy information into this publicly accessible demo. UI role switching is not real authentication or authorization.

### Live cross-device synchronization — still blocked

The Vercel project has an existing connected Supabase resource; it has **not** been modified, and no credentials were retrieved. The current tool session exposes resource connections, but no supported external database connection or SQL migration/admin channel. No shared schema/auth implementation was applied, so this PR must **not** be described as live staff-phone/POS synchronization.

Before collecting actual staff profiles, a database administrator must enable the authenticated backend: provision distinct staff/operator accounts, map employee IDs and operator roles, apply owner-only profile/account access and segment-scoped order permissions, store allergy snapshots + current revision separately, and perform atomic order/stock/account transactions. Both interfaces must then subscribe to the same protected order/profile data with reconnect handling. Avoid a publicly writable/readable shared JSON document: that would expose private bills and allergy information. Server-side SLA jobs and a notification channel are also still required for off-page alerts. Database work must use additive, isolated CALM BREAK tables so existing business-tracker data is untouched.
