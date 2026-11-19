# KVM Business Tracker

A standalone market budget and commercial performance workspace for Kuda Villingili. Built with React, TypeScript, Vite, and Supabase. No original workbooks, employee details, or real budget figures are included in this public repository.

## Features

- Main market dashboard: Asia, America, Middle East, Russia / CIS, Europe.
- Monthly commercial targets, BOB, weekly targets/BOB, villa types, countries, meal plans, and action plans.
- Derived ADR, revenue variance, weighted annual ADR, and budget achievement.
- Local Excel import with a twelve-month review/confirmation; atomic live import with optimistic concurrency checks.
- Market, monthly, quarterly, annual, and consolidated reports. Export Excel with detailed weekly breakdowns or print/save PDF through the browser.
- Email/password sign-in, administrator-managed market assignments, database-enforced permissions, and immutable before/after audit records.
- Responsive desktop/mobile layouts.
- Historical viewing and reports for 2021–2025, alongside existing 2026–2030 years. Select **Budget year** on Overview, a market, or Reports; the same selection drives monthly/quarterly/annual views and Excel/PDF reports. Import each historical market workbook with its matching year selected. Real historical figures are not preloaded; demo mode remains fictional. Existing year-keyed storage and database tables keep each year separate; no database migration is required.

## Total Budget Review

Use **Total Budget Review** below the market tabs for a read-only roll-up of saved records from the five markets. The global Budget year selector and review period (month/quarter/year) control the totals, breakdown tables and exports. Market edits appear in the review after saving; unsaved drafts are never included. No separate total record or FULL BUDGET workbook is imported, so totals cannot double-count a sixth dataset.

Commercial, villa, country and meal-plan rows are summed by label, including all four weekly target/BOB pairs. ADR is calculated as total revenue divided by total room nights, including weekly ADR; it is never the sum or simple average of market ADRs. Weekly columns for annual/quarterly periods sum that week across the selected months. Weekly snapshots do not overwrite or add to monthly BOB. Different category spellings remain separate, and source breakdown units/independent reconciliation rules still apply.

Coverage is shown as available versus expected market-month records, with a missing-period list and per-market contributions. Database permissions are unchanged: managers see only authorized saved records. Incomplete/access-limited results are labeled **Partial total**, not full resort totals; missing values are not estimated. To review the complete resort, an administrator needs access to all five markets and all selected months must have saved data.

**Export total report** produces derived monthly Performance rows and detailed weekly Breakdowns for the selected period, with coverage warnings in the Action plan column. The five-market source rows are not mixed into the totals export. **Print / Save PDF** prints the selected review tab and contribution table with its year/period/coverage labels. Native PDF saving remains a browser action. This feature needs no new database table, permission or migration.

## Demo versus live

Without both Supabase environment variables, the application explicitly runs in **demo mode** with fictional sample numbers. Demo edits are saved only in the current browser's local storage. There is no mock login and demo access does not grant real access. Do not import confidential workbooks on a shared device; demo imports are local but persist in browser storage. Clear site storage to remove them.

With both variables configured, the app does **not** fall back to demo data: sign-in is required to read financial information, and failures are shown. Unassigned users cannot read or save market data, even if they alter the browser. Market names are not confidential and remain visible on the landing page.

## Local development

Use Node.js 22.12+ (Node 24 LTS recommended).

```sh
npm ci
npm run dev
npm test
npm run build
```

## Live setup (required before actual manager use)

1. Create a Supabase project. Run `supabase/schema.sql` **once**, as the database administrator, in a fresh project's SQL editor. Review policies before using production financial data. Never disable row-level security.
2. Create manager accounts using your Supabase Auth administration interface. Disable public user sign-ups. An administrator should issue invitations/password recovery through Supabase; no registration, account provisioning, or password-reset UI is provided in this initial version. Managers sign in with their own email/password. Never send passwords or API keys through chat.
3. Assign users from a trusted database administrator session (replace the placeholders with the appropriate Auth user UUIDs):

```sql
-- One market manager; repeat to grant multiple markets.
insert into public.market_members(user_id,market_id)
values ('<manager-auth-user-uuid>','asia');
-- Optional administrator, who may read/write all markets.
insert into public.app_admins(user_id) values ('<administrator-auth-user-uuid>');
-- To revoke a market assignment:
-- delete from public.market_members where user_id='<uuid>' and market_id='asia';
```

Supported market IDs: `asia`, `america`, `middle-east`, `russia`, `europe`. Memberships/admin roles are not writable from the client. Ordinary managers can update both budgets and BOB for assigned markets; there is no approval/sign-off workflow in this version.

4. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel project's environment variables for the desired environments, then redeploy. For local development, copy `.env.example` to `.env.local` and enter values there yourself. These are browser configuration variables: **never use a Supabase secret or service-role key**. RLS, not key secrecy, protects the data. No server-side secret is needed for this application.
5. Confirm **USD** is the correct reporting currency. The current version assumes USD; there is no automatic currency conversion. Choose the correct budget year, sign in, open a market, then import its matching workbook. Configure database backups and your retention policy before production use.

### Adding Europe to an existing database

For an existing installation created before Europe support, run `supabase/migrations/20261119_add_europe.sql` once as the database administrator. It expands the two market allowlists without deleting records or changing access policies, and is safe to rerun. Fresh installations use the updated `schema.sql` directly. Assign the Europe manager using `market_id = 'europe'` through the existing trusted administrator procedure; no existing manager is automatically granted Europe access. This source update does not apply a migration to a live database.

Europe uses the same 2021–2030 year selector, monthly/weekly editor, report filters, exports and audit history as other markets. The supplied Europe workbook is a 2027 workbook; actual figures are not preloaded into the public demo. Existing browser-saved data for other markets is preserved when Europe demo months are added.

### Workbook mapping and limitations

- Import `ASIA.xlsx`, `AMERICA.xlsx`, `MIDDLE EAST.xlsx`, `RUSSIA.xlsx`, or `EUROPE.xlsx` from the appropriate market. Files are parsed in the browser; no workbook is uploaded to Vercel. In live mode, confirmed parsed figures are stored in your Supabase database.
- Requires JAN–DEC sheets using the supplied layout: market in B4, year in A1, commercial rows 8/9, followed by numbered villa/country/meal-plan sections. B/C = monthly budget/BOB; D/E, F/G, H/I, J/K = weekly target/BOB pairs. ADR is derived, not imported. Existing action-plan notes are preserved; free-form spreadsheet notes and sign-off cells are not imported.
- `FULL BUDGET.xlsx` is a planning reference and is intentionally **not** imported as an additional market. Consolidated totals are calculated from authorized market records, avoiding double counting.
- Import reviews the revenue totals before replacing all twelve months. A stale version, permission failure, or validation error aborts the entire live import. It does not silently merge another manager's changes. Reload and review before retrying.
- Formula cells need cached numeric results: recalculate and save in Excel before importing. Spreadsheet errors, negative values, and unsupported layouts are rejected. Maximum file size: 10 MB. Use only trusted workbooks.
- BOB is business on the books, not realized revenue. Weekly values are independently editable snapshots, not automatically summed into monthly BOB. Villa/country/meal-plan breakdowns are independent; managers must reconcile them to commercial totals. Fractional room-night targets are preserved.
- Reports use saved data, not unsaved drafts. The annual dashboard shows all saved months for the selected year; it is not a date-sensitive actual/YTD report. No booking/PMS integration is included.

### Security and data integrity

Read policies check the authenticated user's assignment on every query. No anonymous financial reads or direct authenticated writes are granted. Versioned RPCs validate nonnegative finite values, enforce assignments and commercial row order, serialize concurrent writes, and create audit snapshots in the same transaction. Audit records cannot be changed by client users. Actors appear by Auth user UUID rather than exposing manager email addresses. Removing an assignment removes subsequent data access but cannot retract exports already downloaded.

Before rollout, verify with two distinct manager accounts that cross-market reads and RPC writes are denied, and verify with an administrator that two concurrent saves produce a conflict. `supabase/security-check.sql` provides a rollback-only smoke test for a configured database. The database, delivery of invitations/password resets, and real sign-in are not configured by this source code alone.

## Preview verification

The unconfigured preview is deliberately reachable signed out in fictional-data demo mode. Check overview, market edits/save/reload, category tabs, report filters, Excel import/export, and the mobile layout. Live mode requires configured Supabase tables and administrator-provisioned test accounts; a READY deployment alone does not verify those flows.

### Dependency review

The ExcelJS UUID dependency is overridden to patched v11.1.1 and covered by workbook tests. At initial creation, `npm audit` still flags a picomatch ReDoS advisory (GHSA-fc5q-39xc-vjpf) in the **development/build** Vite/Vitest globbing chain; the latest available picomatch is also in the advisory range. No dev server or glob API is shipped in the static production app. Do not expose the development server to untrusted networks; revisit the advisory when an upstream patch is available. `npm audit --omit=dev` is clean.
