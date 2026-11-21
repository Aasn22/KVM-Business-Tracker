# KVM BUSINESS LENSE

A standalone market budget and commercial performance workspace for Kuda Villingili. Built with React, TypeScript, Vite, and Supabase. No original workbooks, employee details, or real budget figures are included in this public repository.

## Current authentication: passwordless email links

The active sign-in flow supersedes the historical password/username sections below: **logo animation → email address → private one-time sign-in link → authorized platform**. There are no password inputs on sign-in, no first-password RPC gate, and no username-only account claiming. `/api/username-login` is retired (410). Old password database tables/functions are not dropped or modified, preserving history; they are not used by the active app.

Supabase `signInWithOtp` is called with `shouldCreateUser:false` and an exact same-origin `/auth/confirm` redirect. Only existing Supabase Auth accounts can request access; requesting a link does not register users or grant roles. A generic response avoids exposing account existence; a 60-second client cooldown complements Supabase's email/rate limits. Email delivery errors are shown without provider details. Auth sessions remain managed by Supabase; sign-out and all existing Super Admin/admin/market/country data policies remain unchanged. Accounts created only in custom `public.users` tables still cannot sign in.

Provider setup required: keep Email authentication/magic links enabled, disable public signup, configure SMTP, set the Site URL to the stable production origin, and allow `https://www.faisaa.digital/auth/confirm` (plus explicitly approved preview origins when testing). Magic Link template must use `{{ .ConfirmationURL }}` rather than an OTP-only token template; alternatively use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Invitation callbacks use the same route with type=invite. Only email/magiclink/invite token types are accepted; expired/used/error callbacks give a new-link route and do not bypass authentication. PKCE code and default provider session callbacks are supported. One-use token exchange is shared across StrictMode reruns. No tokens or private sign-in links are logged or displayed in chat.

Legacy forgot/reset/setup/change-password URLs no longer show password forms. After email verification, users proceed directly to the platform subject to existing database role assignments. No username migration is needed to send/verify a magic link, but financial/property/team schema and correctly linked Auth identities remain necessary. Missing role/schema access is not bypassed by passwordless sign-in. This source change does not send any actual email or create/promote accounts.

## Features

- Main market dashboard: Asia, America, Middle East, Russia / CIS, Europe.
- Monthly commercial targets, BOB, weekly targets/BOB, villa types, countries, meal plans, and action plans.
- Derived ADR, revenue variance, weighted annual ADR, and budget achievement.
- Local Excel import with a twelve-month review/confirmation; atomic live import with optimistic concurrency checks.
- Market, monthly, quarterly, annual, and consolidated reports. Export Excel with detailed weekly breakdowns or print/save PDF through the browser.
- Email/password sign-in, administrator-managed market assignments, database-enforced permissions, and immutable before/after audit records.
- Responsive desktop/mobile layouts.
- Historical viewing and reports for 2021–2025, alongside existing 2026–2030 years. Select **Budget year** on Overview, a market, or Reports; the same selection drives monthly/quarterly/annual views and Excel/PDF reports. Import each historical market workbook with its matching year selected. Real historical figures are not preloaded; demo mode remains fictional. Existing year-keyed storage and database tables keep each year separate; no database migration is required.

## Admin Data Input and read-only views

All manual entry, number changes (budgets, BOB and weekly values), category additions, Excel imports and action-plan edits are restricted to **Admin Data Input** at `/admin-data-input`. Choose a market there, then year/month and section. Market pages, Overview, Reports and Management Review are read-only for everyone, including administrators. They show saved values only. Managers may still view authorized markets and export reports; they cannot change data through the client or RPCs.

For a **fresh** database, the updated `supabase/schema.sql` includes these rules. For an **existing** database, a database administrator must run `supabase/migrations/20261119_admin_only_data_input.sql` before rollout. It replaces the two write RPCs with admin-only checks and adds a role lookup RPC without changing records, assignments, read policies, version checks or audit triggers. Existing manager sessions immediately lose RPC write access when the migration is applied. Apply the Europe migration too if that installation predates Europe. No migration is automatically applied to a live database by deploying this source.

Admins are provisioned only through `public.app_admins` by a trusted database administrator. The client queries `is_app_admin()` (a protected, stable security-definer function) and fails closed while loading or if the migration/lookup fails. Market memberships alone never grant write access. Every save/import rechecks admin status in the database, including after role revocation. There is no client-side self-promotion. A stale open UI cannot bypass database rejection.

The unconfigured **demo** provides a clearly labeled Demo Admin Data Input without sign-in for testing fictional data in local browser storage only. It does not create or imply live administrator privileges. Test `/admin-data-input` directly or via the sidebar, choose a market, save/import, then verify the corresponding market and total views. Do not place private budgets in a shared-device demo. Live role/login flows still need a configured Supabase project and real test accounts.

## Property Setup

Open **Property Setup** in the sidebar or `/property-setup`. Every signed-in system user (including unassigned users, market managers, and regular admins) can view the shared property profile. Anonymous financial/property database access remains denied. **Only Super Admin** can edit property name, address, logo, three-letter property currency code, villa categories/unit inventory, and meal plans. Inventory total is calculated from category units. Default address is unset; inventory uses the supplied physical unit counts.

For existing installations, run `supabase/migrations/20261119_property_setup.sql` as database administrator. Fresh installs include it in `schema.sql`. Assign a Super Admin from a trusted database administrator session only:

```sql
insert into public.app_super_admins(user_id) values ('<super-admin-auth-user-uuid>');
-- Revoke with: delete from public.app_super_admins where user_id='<uuid>';
```

Super Admin is a **separate** role: existing `app_admins` are not promoted, and Legacy Super Admin table membership alone does not automatically grant budget-entry rights. A linked team Super Admin profile grants both, while a linked Admin profile grants financial entry but not property editing. There is no browser role-assignment feature. RLS permits authenticated reads; no direct client writes are granted. A security-definer RPC rechecks Super Admin on every save, validates content, uses optimistic version checks, and writes immutable before/after audit snapshots. Audit rows/role memberships are not exposed to client users. Changes or revoked roles in another session may leave stale UI until reload, but the database rejects unauthorized writes immediately.

Logos accept PNG/JPEG/WebP up to 200 KB, are decoded in the browser, and saved as bounded image data URLs in the property record. SVG, script URLs and external/tracking image URLs are rejected. Configuration load or role errors fail closed and do not show an editor. Existing database migrations have not been applied live by this source update.

**Scope:** these are property-profile settings, not a destructive migration of saved financial history. Changing currency does not convert or relabel historical USD budgets; inventory is a reference rather than historical occupancy; villa/meal-plan changes do not rewrite existing market categories; property logo/name are displayed on this page without replacing the fixed resort branding across reports/entrance. This avoids silently altering budgets and past reports.

Unconfigured demo mode opens the page **read-only** with “Try Super Admin editing” for explicitly simulated local-only editing. No real privilege is granted. Demo settings persist separately from market budgets in browser local storage. Save, Cancel, unsaved-navigation warning and reload behave independently from Admin Data Input. Live configuration requires migration and real accounts.

## Account invitations and passwords

Account flows are now provided at `/setup-password` (invitation), `/forgot-password` (email request), `/reset-password` (recovery link) and `/change-password` (signed-in voluntary change, current-password reauthentication required). Minimum is **6 Unicode characters**, allowing letters/numbers/symbols without a required mixture. Set the Supabase Auth project's password minimum to 6 and no character-class requirements to match; provider-side limits still own enforcement. Passwords are never displayed, saved to app tables, logged, or set to a shared default.

After all previous schema migrations, run `supabase/migrations/20261119_password_setup.sql`. It exposes only whether the caller's provider account has a password (never a hash). The auth shell asks invited users with no password to set one before entering the app, including on reload. This is a UI onboarding gate, not a replacement for database row-level permissions. Apply migrations before enabling live auth; lookup errors fail closed. Existing accounts with passwords are not forced to reset on each login.

For first login, use **Property Setup → team member → Invite** as a verified Super Admin after privately entering the user's individual email. `/api/invite-user` verifies the caller with Supabase, rechecks Super Admin and completed password setup, accepts only email/profile ID, sends one private invitation and links the already-reviewed profile's role/scope. Already linked profiles are not reinvited. If invitation succeeds but linking fails, the API explicitly reports partial completion: review Auth and link manually before retrying. No bulk account creation runs on deploy.

The server endpoint needs `SUPABASE_SECRET_KEY` (server-only, NEVER VITE-prefixed) and `BUSINESS_EYE_APP_URL` (the stable HTTPS application origin), in addition to the existing Supabase URL/publishable configuration. Enter these privately in Vercel environment settings or your ignored local `.env.local`, never in chat. The secret is used only by the server invitation function and is not bundled into the browser. Keep environment access restricted to trusted collaborators. Local Vite alone does not run the Vercel API function.

Configure Supabase Site URL/allowed redirects for the stable deployment's `/setup-password` and `/reset-password`. Default invite links must redirect to `/setup-password`; recovery links to `/reset-password`. Alternatively configure email templates using `{{ .SiteURL }}/setup-password?token_hash={{ .TokenHash }}&type=invite` and `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`; only invite/recovery token-hash callbacks are accepted and callback parameters are removed after verification. Tokens stay in provider/browser flow, never in app logs. Invalid/expired links show a recovery route. Use real email delivery (SMTP), provider rate limits and disable public signups. The first Super Admin invitation/role assignment must be bootstrapped by a trusted Supabase administrator; it cannot be self-provisioned in the browser.

Forgot-password submits to Supabase with a generic success response so account existence is not disclosed by the UI. A 60-second client retry delay complements provider limits. Voluntary change requires current-password reauthentication; users who forgot it use email recovery. After successful setup/reset/change, the app reloads into the normal sign-in/session flow. In unconfigured demo mode, password pages clearly state that authentication/email is disconnected and cannot send invitations, update passwords or create users.

**Rollout status:** the supplied team PDF contains usernames/permissions but no email addresses. No live accounts have been created or invitations sent. The Vercel project currently has no environment variables or connected Supabase resource. Supply a private email-to-username mapping, connect/configure Supabase, apply migrations and provision the first Super Admin before using Invite. Do not use passwords from the supplied roster.

## Property codes, team directory and country access

Defaults now match the supplied **75 physical villa units** and ten villa codes; meal-plan setup includes BB, HB, HBR, FB, FBR, AI and UAI with descriptions. The new HBR/FBR plans configure the property only; no historical bookings are fabricated. Existing saved property profiles are never silently overwritten: Super Admin can choose **Use supplied villa & meal plan configuration (75 units)** then Save property. Codes are validated on client/database writes. Property details still do not rewrite financial history.

**Team members & access** is part of Property Setup, visible to all authenticated users and editable only by Super Admin. It stores name, position, department, level, informational username, access role and financial scope. No password field exists. Private roster JSON import rejects credential fields; the supplied private roster is not in this public repository. Import creates unlinked profiles (no login access), then privately invite each user in Supabase Auth and link its UUID through the Super Admin editor. Usernames do not replace email/password Auth. Live batch imports report partial progress; review rows before retrying, since the batch is not atomic. Auth UUIDs are not exposed in the directory's read view. Profile permission changes are versioned/audited; no self-promotion or self-removal of current Super Admin is allowed.

Apply `supabase/migrations/20261119_team_country_access.sql` **after** the admin-only and property-setup migrations on existing installs; fresh schema includes it. No live migration, private roster import or account invitations have been performed here. Team-linked profiles are authoritative over legacy role/market grants. `all` viewers can read every market/report; selected-market viewers see only their assignments; Admin can enter financial data; Super Admin can edit property/team and all financial pages. Never assign country-only users a broad legacy role in lieu of their country profile.

**India and Kazakhstan are strict country-only financial scopes.** Once linked, those users cannot query market_months or regional audit rows even if stale regional/app_admin grants exist. Financial pages display only their own `country_months` records through RLS; changing a client selector cannot widen access. Admin Data Input has a separate country financial input panel for explicit country room nights/revenue. The original country rows in market workbooks contain booking breakdowns, not a full country revenue/night budget, so these records are **not** inferred or fabricated from regional figures. No data means unavailable, not a regional fallback. Country exports contain only the permitted country records; no regional notes or villa detail is leaked. Country records are not automatically added to their parent market's totals, which would double count; administrators must reconcile inputs.

Country users still see Property Setup and directory metadata, as requested, but not other countries' finances. Admins/Super Admins may enter country figures; country users are read-only. Role changes affect database access immediately, but active browser views may need reload; previously downloaded/cached information cannot be retracted. Live country permissions require the migration and correct invited-user linkage before rollout.

## Management Review

Use **Management Review** directly below KVM-OVERVIEW for an automatic, read-only spreadsheet-style report based on saved authorized market records. There is no separate input, full-budget import or stored management dataset. Admin saves update the shared records used by market views and the management report in the same app session. Reload to pick up changes from other sessions; no realtime database subscription is configured.

The report follows the reference layout: annual budget summary; monthly commercial targets; villa targets; quarterly performance/corrective actions; meal-plan control; every market's quarterly/annual contributions and saved monthly action plans; sign-off status. Select all markets or an individual market and choose which quarter's three monthly columns are expanded. All four quarters and full-year totals remain visible, while Excel includes every month and quarter. Annual and category sections are all shown, not hidden behind edit tabs.

BOB remains **business on the books**, never relabeled as MTD actuals. Gap is BOB minus budget (negative means below budget). ADR is weighted room revenue divided by room nights, never a sum/average of individual ADRs; zero room-night denominators show unavailable rates. Category rows sum matching labels with source units preserved. Missing records/category rows show a dash, partial period coverage is disclosed, and known zero values remain zero. Data access policies are unchanged; inaccessible markets cannot be included in totals. No missing amounts are estimated.

Occupancy (no room inventory denominator), MTD actuals, forecasts, F&B/other/total revenue, category-level ADR, director feedback and signatures are not in the source model. These show **Not available** rather than copied sample values, fabricated estimates, or new manual fields. Saved market action-plan text is displayed with market/month/quarter provenance. No sign-off names/status are inferred from workbook examples.

**Export management report** exports Management Review, Market Performance and Actions worksheets with all months/quarters/year, coverage, source definitions and unavailable-field disclosures. **Print / Save PDF** prints the report in a landscape A3 layout; save-to-PDF is a browser action. Tables scroll horizontally on smaller screens. This report update requires no schema or access changes; existing admin-only migration requirements still apply.

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
2. Create manager accounts using your Supabase Auth administration interface. Disable public user sign-ups. Use private invitations through the Super Admin team UI after server configuration. Password setup/recovery/change pages are provided; public registration is not. Managers sign in with their own email/password. Never send passwords or API keys through chat.
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

Supported market IDs: `asia`, `america`, `middle-east`, `russia`, `europe`. Memberships/admin roles are not writable from the client. Ordinary managers have read-only access to assigned markets; only application administrators can save or import any data; there is no approval/sign-off workflow in this version.

4. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel project's environment variables for the desired environments, then redeploy. For local development, copy `.env.example` to `.env.local` and enter values there yourself. These are browser configuration variables: **never use a Supabase secret or service-role key**. RLS, not key secrecy, protects the data. No server-side secret is needed for this application.
5. Confirm **USD** is the correct reporting currency. The current version assumes USD; there is no automatic currency conversion. Choose the correct budget year, sign in as an administrator, open Admin Data Input, select a market, then import its matching workbook. Configure database backups and your retention policy before production use.

### Adding Europe to an existing database

For an existing installation created before Europe support, run `supabase/migrations/20261119_add_europe.sql` once as the database administrator. It expands the two market allowlists without deleting records or changing access policies, and is safe to rerun. Fresh installations use the updated `schema.sql` directly. Assign the Europe manager using `market_id = 'europe'` through the existing trusted administrator procedure; no existing manager is automatically granted Europe access. This source update does not apply a migration to a live database.

Europe uses the same 2021–2030 year selector, monthly/weekly editor, report filters, exports and audit history as other markets. The supplied Europe workbook is a 2027 workbook; actual figures are not preloaded into the public demo. Existing browser-saved data for other markets is preserved when Europe demo months are added.

### Workbook mapping and limitations

- Import `ASIA.xlsx`, `AMERICA.xlsx`, `MIDDLE EAST.xlsx`, `RUSSIA.xlsx`, or `EUROPE.xlsx` from the appropriate market. Files are parsed in the browser; no workbook is uploaded to Vercel. In live mode, confirmed parsed figures are stored in your Supabase database.
- Requires JAN–DEC sheets using the supplied layout: market in B4, year in A1, commercial rows 8/9, followed by numbered villa/country/meal-plan sections. B/C = monthly budget/BOB; D/E, F/G, H/I, J/K = weekly target/BOB pairs. ADR is derived, not imported. Existing action-plan notes are preserved; free-form spreadsheet notes and sign-off cells are not imported.
- `FULL BUDGET.xlsx` is a planning reference and is intentionally **not** imported as an additional market. Consolidated totals are calculated from authorized market records, avoiding double counting.
- Import reviews the revenue totals before replacing all twelve months. A stale version, permission failure, or validation error aborts the entire live import. It does not silently merge another administrator's changes. Reload and review before retrying.
- Formula cells need cached numeric results: recalculate and save in Excel before importing. Spreadsheet errors, negative values, and unsupported layouts are rejected. Maximum file size: 10 MB. Use only trusted workbooks.
- BOB is business on the books, not realized revenue. Weekly values are independently editable snapshots, not automatically summed into monthly BOB. Villa/country/meal-plan breakdowns are independent; administrators must reconcile them to commercial totals. Fractional room-night targets are preserved.
- Reports use saved data, not unsaved drafts. The annual dashboard shows all saved months for the selected year; it is not a date-sensitive actual/YTD report. No booking/PMS integration is included.

### Security and data integrity

Read policies check the authenticated user's assignment on every query. No anonymous financial reads or direct authenticated writes are granted. Versioned RPCs validate nonnegative finite values, enforce administrator-only writes and commercial row order, serialize concurrent writes, and create audit snapshots in the same transaction. Audit records cannot be changed by client users. Actors appear by Auth user UUID rather than exposing manager email addresses. Removing an assignment removes subsequent data access but cannot retract exports already downloaded.

Before rollout, verify with two distinct manager accounts that cross-market reads and RPC writes are denied, and verify with an administrator that two concurrent saves produce a conflict. `supabase/security-check.sql` provides a rollback-only smoke test for a configured database. The database, delivery of invitations/password resets, and real sign-in are not configured by this source code alone.

## Preview verification

The unconfigured preview is deliberately reachable signed out in fictional-data demo mode. Check overview, admin entry/save/reload and locked market viewing, category tabs, report filters, Excel import/export, and the mobile layout. Live mode requires configured Supabase tables and administrator-provisioned test accounts; a READY deployment alone does not verify those flows.

### Dependency review

The ExcelJS UUID dependency is overridden to patched v11.1.1 and covered by workbook tests. At initial creation, `npm audit` still flags a picomatch ReDoS advisory (GHSA-fc5q-39xc-vjpf) in the **development/build** Vite/Vitest globbing chain; the latest available picomatch is also in the advisory range. No dev server or glob API is shipped in the static production app. Do not expose the development server to untrusted networks; revisit the advisory when an upstream patch is available. `npm audit --omit=dev` is clean.

## Branded entrance

Every full page entry (including the direct admin URL or reload) opens with a navy-blue Kuda Villingili entrance screen, using the supplied logo with its white matte removed to transparent PNG. A soft rose-gold glow and single zoom-in animation automatically dismiss after 3.6 seconds. It does not repeat on in-app tab/market/year navigation. Enter workspace or Escape skips immediately. Reduced-motion preferences disable the animation and shorten the screen to 0.7 seconds. The underlying app is inert/hidden from assistive technology until dismissal; the entrance does not change authentication or permissions. The dashboard retains its existing colors after the navy entrance fades.

## Connected Supabase deployment

The Vite build accepts an exact allowlist of provider-managed public names (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and equivalent non-secret URL/publishable aliases), in addition to explicit VITE variables. No broad environment prefix is enabled; database passwords, JWT secrets and service keys are never embedded. Every full page entry shows the smaller 270px desktop / 220px mobile maximum entrance before the authentication gate. Configured deployments require sign-in before any platform view. Login currently uses email/password; no insecure username-only account claiming is offered. Username-only accounts with privately set temporary passwords are not provisioned by this source change.

Do not publish as ready until the schema is applied, the owner Auth account is privately created and activated as Super Admin, allowed redirects/provider password policy are configured, and live role tests pass. Connection alone does not create database tables or accounts. The existing production alias must not be assumed to serve the latest PR code.

## Username sign-in correction

Sign-in now uses **username + password**. `/api/username-login` resolves only linked `team_directory` usernames on the server with service credentials, verifies the password through Supabase Auth, and returns session tokens—not an email lookup. Anonymous clients cannot call the lookup RPC. Usernames are case-insensitive and must be unique; the migration stops on existing ambiguous duplicates. A persistent per-username limit of 10 attempts per 15 minutes supplements Supabase Auth limits; both wrong and unknown usernames return the same error. Add edge/IP abuse controls for production scale. No passwords or returned session tokens are logged by this code.

Apply `supabase/migrations/20261119_username_login.sql` after the existing KVM BUSINESS LENSE migrations. Custom `public.users` or `user_sessions` created by another agent are **not** valid Supabase Auth accounts and are neither used nor deleted by this migration. A real Auth user must exist and its UUID must be linked to the team profile. No chat-provided password is set by this code.

For a privately chosen temporary password, a trusted database administrator can insert the Auth user's current provider hash into `required_password_changes` using `insert ... select id, encrypted_password from auth.users where id=...`. Never copy/display hashes. This forces setup in the app; `complete_password_change()` clears it only after Auth reports an actual password-hash change. Password setup remains a UI onboarding gate, while database authorization is separate. Accounts must be correctly provisioned before permissions can be exercised. Recovery still uses private email, not username-only claiming. Live username login cannot succeed until Auth account linking and migration are complete.

## Public entry dashboard

Anonymous visitors to the main `/` URL now see the logo animation followed immediately by a **read-only fictional-data dashboard**, not a login form. No real market data is made anonymous/public and no RLS policy is weakened. Public mode ignores all browser-saved market imports (which might be private), uses freshly generated fictional figures, never subscribes to the live Auth user, cannot save/import/edit, and hides property/team/admin configuration controls. Market viewing, Management Review and exports use only fictional demo data in this mode. Protected admin/live access remains at `/admin-data-input` with email-link authentication; direct protected paths do not receive the public fallback. Signed-in users continue to see their authorized live dashboard. This is not consent to publish real budgets.

## Public real budgets (authorized publication)

The owner explicitly authorized public real-budget viewing. The main URL now publishes only numeric financial sections from the five supplied 2027 market workbooks (60 months); `FULL BUDGET.xlsx` is excluded to avoid double-counting. These actual figures are now intentionally in the public deployment/repository baseline; staff details, passwords, notes and signatures are excluded. The baseline total room-night budget is 22,042. Only 2027 source data was supplied; historical years do not get fictional fallback values.

`/api/public-budgets?year=...` reads saved `market_months` through a server-only key, returns an explicit allowlist of financial row fields and blanks notes. No team, Auth, property, audit or country-specific private endpoint is exposed. Public entry merges database months over baseline months and refreshes every 60 seconds. The banner states exactly whether database rows or only published workbook figures are available. A database error shows the actual workbook snapshot with a non-live warning, not fake figures. In years without a baseline, unavailable remains empty. Existing financial read restrictions still govern authenticated private views, but these five-market numeric figures are intentionally public by owner authorization. Admin saves remain protected.

A guarded real-2027 SQL import is provided separately in chat; it refuses to overwrite existing 2027 records. This session has not executed it. The app can display real workbook figures before import, but fully persisted editing/synchronization needs the KVM BUSINESS LENSE schema and imported database rows. The public endpoint does not modify the database or provide a write bypass. No provider or Auth role changes are made by this publication.

## PIN entry and local editing (current)

Protected paths now use `PinShell`, not Supabase Auth. The public `/` page continues to display the published real workbook figures. Open `/admin-data-input` or `/property-setup` for a PIN entry screen. No email, username or Supabase Auth user is required. PIN unlock grants **browser-local** budget editing/imports and property configuration, not shared database roles. Initial financial records come from published real figures. Edits are stored separately in `business-eye-local-YEAR`; no fictional financial records are generated. Changes do not publish to the site or synchronize to other devices. Export Excel backups; clearing browser storage deletes local edits. Team directory/account administration is not included in this local mode. Property data is local too; changes do not rewrite historic financial records.

The owner must set **BUSINESS_EYE_PIN** privately in Vercel Environment Variables for Production and Preview, then redeploy. Minimum 4 characters; use a long, random value rather than a short numeric code. Never commit or send the value in chat, and never prefix it with VITE. No chat-supplied PIN has been configured. Until configured, the endpoint returns 503 with clear setup guidance, never an automatic unlock.

`/api/pin-session` validates on the server and issues a four-hour HttpOnly, Secure, SameSite=Strict signed cookie; PIN values aren't returned or logged. The key is derived from the configured secret; rotating it revokes existing sessions. Requests must originate on the current HTTPS host. Five attempts per 15 minutes per process/IP provide a best-effort backstop, **not distributed brute-force protection**; configure edge rate limiting before relying on short PINs. The screen is a convenience gate only: browser-local records and JavaScript are not encrypted and can be inspected/modified by someone with browser access. Public workbook figures remain public. This is not a substitute for authenticated shared budget administration. Old Supabase invitation/auth endpoints and database policies are not used or weakened by the local editor.

## Commercial Pulse status and Other Markets

Portal entry is now Commercial Pulse. Status names the Director of Revenue & Team as data maintainers; Opera PMS is explicitly **not connected**. No Opera data source or live integration is claimed. Public source detail remains expandable and the badge states snapshot versus database availability. Red uppercase LAST UPDATE BY TEAM uses the latest valid saved market-record timestamp (UTC); it never substitutes page load/deployment time or attributes an individual actor. With no saved timestamp it says DATE/TIME NOT AVAILABLE. A pulsing indicator only marks successful database reading, not a real-time PMS feed; reduced motion disables it. The local editor labels timestamps as THIS BROWSER and local-only.

Other Markets follows Europe, supports the same years, period reports, monthly/weekly entry, category sections and Excel import/export. It has no published figures until entered; missing coverage is disclosed, not estimated. Local edits retain existing local-only persistence. The five uploaded baseline workbooks and their totals are unchanged. New data becomes included in consolidated coverage/totals as a sixth market. Fresh schema includes its ID; existing live installations require `supabase/migrations/20261120_add_other_markets.sql` before database persistence of this market. This migration has not been applied by this code change.

### Compact status bar

The current banner is a compact maintenance line and red `Last update: ...` timestamp, not uppercase verbose provenance. The source disclosure and extra badge subline are removed. Opera remains explicitly not connected; published workbook provenance remains in the page footer. The decorative status dot pulses beside the timestamp (reduced-motion disables it); this animation is not proof of an active feed. Timestamps still use actual saved records only, with Not available for missing metadata. Local timestamps remain labeled local; browser-only save limitations are unchanged.

## KVM Portal and Business Insight (20 November 2026)

Navigation: KVM PORTAL contains Commercial Pulse (with pulse icon), Management Lense, Reports and Business Insight. MARKET INSIGHTS replaces Your Markets. Management Lense naming propagates to headings and exported report sheets. Dense desktop navigation has no inter-item gaps; mobile/tablet keeps 44px touch targets. Commercial Pulse headline is reduced to one line at desktop/tablet landscape widths, with normal wrapping on narrow phones for readability (never clipped).

The maintenance caption now uses the owner's description, “Database manually sourced from Opera (PMS) · Maintained by Revenue Director & Team.” This identifies an owner-reported manual source, not an automated Opera connection; published financial data is still from supplied spreadsheets. No PMS API integration or shared persistence was added.

`/business-insight` is a public, read-only research page under the same entrance. Curated source data is in `src/insightData.ts`, reviewed 20 November 2026. Chart values and reporting periods are explicit: Ministry 2024/2025 annual counts; Sun's 18 November report of Ministry YTD figures through 17 November (secondary, not directly verified Ministry data); MMA travel-receipts series 246 Jan–Aug 2026; UN Tourism's September H1 2026 Barometer and earlier June expert survey. Official Ministry daily/status hub listings available to the research stopped in October; the page discloses that gap and links both hubs, rather than claiming a complete latest Ministry feed. Later source figures may be revised. No automated ingestion/refresh or news scraping is configured: update the source module after reviewing newer releases. The research review date must not advance just because a page/deployment reloads.

Business Insight includes charts with numeric data tables and source links, a topic filter, hospitality demand context, global conflict transmission risks and an executive watchlist labeled analysis. National arrivals, receipts and global statistics are not property budgets. Full-year, YTD and quarterly values are never combined into a fabricated same-period total. Global conflict survey percentages are opinions, not arrival-loss estimates. Changes on this page do not edit financial figures or relax PIN/data protections. API/email/browser-local save limitations remain unchanged.

## Executive visual report library

Reports (`/reports`) now opens a navy/gold animated-logo welcome on each page visit, then a report library with seven icon categories: executive overview, market performance, monthly pace, room nights/ADR, villas, countries and meal plans. Choose market, budget year, month/quarter/year, optional title and report type. Generation performs real capture/calculation/render-preparation stages and supports cancellation. No invented timed percentages or server/AI generation claims. The snapshot is fixed at generation, uses saved inputs only, excludes unsaved drafts, and is separate from later edits or public refreshes. Up to eight recent snapshots are retained in memory during that Reports visit; leaving/reloading clears them. Export for retention.

Visual snapshots include budget/BOB paired bars, monthly trend or market-mix donut as applicable, executive summary, coverage/missing-record disclosures, weighted ADR, market/monthly detailed tables and weekly snapshot totals. Missing data is unavailable, never a fabricated zero. Category breakdowns remain independent source units and are not summed into commercial revenue. Room-night/ADR reports do not invent occupancy or forecasts. BOB is not actual revenue. Public reports capture published workbook figures plus any available saved database overlays; the PIN local editor's Reports captures its browser-local saved inputs. Local edits do not become shared inputs by generating a report.

Print / Save PDF uses browser printing of the generated visual report; select Save as PDF and enable background graphics where supported. Snapshot Excel exports metadata and underlying tabular values at source precision (not chart images). Print/color fidelity depends on the browser. On-page values may be rounded. The generation timestamp is separate from last-saved input timestamp. Existing owner-facing confidentiality notice is unchanged; no role, PIN or financial data authorization changes. Automated booking/PMS integrations, shared report storage and scheduled report email delivery are not part of this feature.

### Quick Reports refinement

The report builder and filters remain. Large cards are replaced by twelve compact icon shortcuts under QUICK REPORTS using the supplied names. Hotel Performance uses the existing executive snapshot; Market, Villa, Country and Meal Plan shortcuts reuse their saved-data report engines. Monthly/Quarterly/Yearly shortcuts constrain periods: selected month or January fallback, selected quarter (or quarter containing a selected month, otherwise Q1), and full year respectively. The library explains these defaults and the generated report always displays the actual period.

Market Segment, Sales Performance and Cancellation shortcuts display an inputs-required explanation: those fields aren't collected and no figures are inferred from geographic markets or BOB. Business Pace currently generates saved monthly/weekly snapshots with a prominent scope limitation, not true booking pickup. Its limitation is retained in the report and Excel metadata. No extra data-entry model or invented report was added.

Owner-specific audience wording is removed from report welcome/header and placeholder. Direct `/reports` bypasses the global logo/confidentiality overlay and shows the report-specific animated logo welcome with Explore Report Library only. In-app navigation to Reports likewise mounts this welcome; the general entrance elsewhere and all PIN settings remain unchanged.

## Reports Library and daily menu introduction

Reports navigation, breadcrumb and page heading are named Reports Library. Sidebar is dark navy. On the first visible platform entry of a local calendar day on collapsible-menu viewports (up to 1366px), the menu opens for 2.8 seconds then returns to collapsed. It waits until the platform is not hidden/inert behind the entry screens. It never takes focus, blocks controls or freezes page scrolling. Toggling, focusing or touching the menu cancels automatic closing so intentional navigation wins. Reduced-motion removes sliding. Desktop's always-visible sidebar is unchanged.

Daily eligibility is per browser/origin via `kvm-menu-introduction-day`, not per authenticated user: the current public platform has no user login identity. Private/incognito windows, other devices/domains or clearing site storage can show it again. Blocked storage falls back to in-memory tracking for the page session. It does not run again on in-app tab changes or same-day reload when storage works. No PIN values, roles or budget data are stored in this marker.

## Display formatting refinement

Only the Reports welcome panel's navy fill is removed (transparent); its text, logo, controls and all other palettes remain unchanged as requested. Revenue/ADR now use one shared en-US dollar formatter: `$1,234,567` with comma grouping, whole-dollar rounding for display, and `($1,234,567)` for negatives. Source values and calculations keep full precision. Counts/percentages/independent category-unit figures are not relabeled as dollars. Compact count displays use uppercase K/M, while revenue stays full-length rather than abbreviated. Business Insight MMA receipts are converted from source millions to dollar units for display, with source arrays unchanged. Excel keeps numeric values and uses dollar number formats only on identified revenue/ADR cells. Numeric input controls remain raw editable numbers; read-only figures and reports carry the formatted amounts. Property currency code configuration remains USD; no conversion is performed.

## Minimal admin PIN and compact Insight amounts

Admin PIN entry now uses an isolated minimal navy/gold design: Kuda Villingili logo above a PIN field, Unlock button and “Restricted access only for admins.” Existing endpoint validation, cookie expiry, errors, locked-child behavior and browser-local editor limitations are unchanged; this label is not a new per-user role check. Detailed local-save notices remain inside the unlocked workspace and documentation.

Business Insight alone uses compact dollar amounts rounded to whole K/M (e.g. `$400M`); this applies to its cards, charts, accessible descriptions and expanded chart tables. Source amounts are unchanged, and all financial/platform/report pages elsewhere still use full `$400,100,000` style. Compact Insight figures are rounded displays, not revised data.

## Named admin entry and browser-local Activity Log

Admin routes `/admin-data-input`, `/property-setup` and `/activity-log` skip the platform logo/confidentiality animation and go directly to the PIN box. GO BACK links to the public root in the same rounded gold-outline style as the platform Continue button. A name (1–80 characters) and PIN are required on each full admin entry; an existing cookie does not identify a person or silently skip the name screen. Names are self-reported, not verified user accounts. The PIN remains server-validated; names are not sent to Auth or used to grant roles.

Activity Log is now a PIN-gated route with three responsive boxes: access events with date/time, update authors/times without change details, and latest change summaries/authors/times. The year control is hidden. Public menu and bell navigate to the protected route; local admin navigation stays inside the existing named session. User-entered names/history are not included in public endpoints or repository datasets.

History uses `kvm-browser-activity-v1` in localStorage, newest 200 records only: one anonymous public visit per full document, successful named admin unlocks, successful local monthly saves, workbook imports, and local Property Setup saves. Public visits cannot be attributed to a name; other devices, prior visits and failed/unsaved edits are not inferred. It logs metadata only, never PIN, financial before/after values or notes. Storage failures are reported; clearing/editing browser storage removes/changes history. This is a convenience browser log, **not immutable, cross-device or complete platform auditing**. All viewers' activity requires a shared backend; none is provisioned by this change. Existing financial edits remain browser-local.

## Separate daily cancellation / reservations-entered uploads

Named PIN Data Input has two From/To/file panels. Selectable-text PDFs in the supplied Opera landscape report layouts, header-based CSV/comma-or-tab TXT and single-worksheet XLSX are supported (15 MB, PDF ≤100 pages, ≤10,000 rows). Legacy XLS, scanned PDFs/OCR and arbitrary spreadsheet layouts are not supported: export to CSV/XLSX. Use CSV header templates; dates are YYYY-MM-DD or DD-MM-YY/DD-MM-YYYY text. Preview/validation precedes an explicit Save. Parsed approved fields only are persisted, not original files, filenames, guest/staff names, booking/cancellation references or contacts. Company/agent/source is retained because explicitly requested. Confidential fields may exist transiently during browser parsing, never committed or sent to server.

Cancellation capture: room type, arrival, lead time, nights, market code, rate code, revenue loss, cancellation date. Country unavailable (not inferred). Reservations-entered capture: room type, company/agent/source, arrival/departure, nights, meal plan, nationality, country code, rate code, reservation type, total room revenue and entered-on date. Room quantities were not approved, so these reports show stay nights (excluding SHARER rows), **not calculated occupied room nights**. Entered records include COMP/MOV/SHARER/CHECKED IN etc.; the UI explicitly does not claim all are confirmed revenue bookings.

PDF parsing uses fixed known column positions and validates total revenue against source totals; cancellation count/nights also reconcile. Unknown layouts or dates fail closed. PDF.js is loaded on demand with bundled worker, no external worker CDN. Imports must have dates within selected activity window, and whole-file hashes plus overlapping date ranges of the same report kind are rejected. This deliberately blocks corrected/overlapping reimports rather than risking double-counting: no replace/delete/reconciliation workflow yet. Distinct rows without booking IDs are not silently collapsed.

Browser-local `kvm-operations-v1` is separate from market/month budgets. Saving cannot update BOB, market balances, budgets or public endpoints. Reports Library inside named admin session has Cancellation and Reservations Confirmed shortcuts with explicit reservations-entered scope, date filters, source-row totals, room-type amount bars, detailed rows, fixed generated snapshots, CSV and print/PDF options. Public Reports never reads private operational storage; it directs users to PIN-local entry. No shared data/users-on-other-devices support is configured. Existing logs record import kind/date range, not source-row data. Only the report welcome text and Explore icon are recolored to logo rose-gold (#bea095); other palettes untouched.

### Quick Reports first

After Explore Report Library, Quick Reports is the default. Filters and Build your report are hidden behind Generate Your Own Report; the button exposes/collapses that section. Report year is inside that custom section, not in the Reports header or welcome. The active year/market/period is still summarized so shortcut output is not ambiguous. Hiding the builder restores all Quick Reports (category filtering only affects the open-builder view). Data Input uploads and rose-gold welcome typography are included in the same release; BOB/market totals and local-only persistence are unchanged.

### Print and cancellation presentation

Generated report print sheets now request A4 landscape with 12mm margins, black-on-white readable text, repeated detail-table headers, non-splitting rows/KPI blocks and visible bar ink. Interactive date/filter/action controls are excluded. Large detail tables flow across pages; a one-page output is not forced by shrinking text. Browser print settings can override CSS paper/margins; background graphics may still be needed in some engines for filled charts. Native print/PDF output must be checked in the user's browser.

Date inputs have explicit calendar-icon buttons calling the browser's date picker where supported, with focus fallback (keyboard text entry remains available for accessibility). Cancellation KPIs are Cancelled Room Nights Total (source Nts. sum; room quantities unavailable), Room Revenue Loss, Highest Cancellation Country (Not available until supplied). No guessed country ranking or currency/data changes.

## Public operational reports and calendar-only input

All Reports Library shortcuts now open without PIN. Only Administrator pages and server publication require the existing PIN cookie. Operational report generation fetches approved rows from `/api/operations` for the selected activity date range, with no visitor login. Server sanitizes the response; original PDFs, filenames, guest/staff names, PINs and account data are not exposed. Company/agency/source remains part of the owner-approved publication fields. Upload Save now means shared publication; failures never silently claim a successful shared/local save. A legacy-import panel lets admins publish previous browser-only imports; they are NOT automatically uploaded without that click. Existing source same-file/date-overlap guards retained, server-side migration uses transaction lock to prevent concurrent duplicates. No BOB/market budget updates from these daily activity reports.

**Activation:** run `supabase/migrations/20261120_shared_operational_imports.sql` as database owner. This session cannot execute Supabase SQL. Server uses configured SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). Until migration exists, visitors see shared-storage errors; if their own browser contains legacy uploaded rows, they may generate from those with an explicit unpublished-local-only label. Empty shared ranges stay empty, never replaced by local figures when database read succeeds. Shared saves/reports need a live cross-device check after migration. Direct public database grants are NOT added; reads/writes go through allowlisted server handler. API has record/payload caps; production abuse/volume limits may need further hardening for high traffic.

DatePicker now renders only a calendar icon, read-only selected date text, and a custom month/year/day selection popover—no date input or typing/paste path exists. Calendar supports keyboard button/select navigation, Escape/outside close and focus return. It replaces all existing date-picker usages in Data Input and operational reports. Plain source-file date parsing remains unchanged.

## Primary reservation history / forecast sources (21 November 2026)

Six Admin Data Input sections mirror the requested layout: History and Forecast, each by Market Codes, Room Types and Country Codes. Each requires calendar-only From/To dates matching the PDF filters, file selection, preview and explicit Publish/Replace. The room-type forecast parser is deliberately unavailable until its missing example is supplied. Other five supplied PDF formats are selectable Opera landscape grids, parsed by daily date/code/metric positions including horizontally split column pages. Source Total columns and report Totals blocks are reconciliation references, never counted as records. Signed revenue adjustments are retained. Daily room/revenue totals must reconcile, all dates in the source range must be present, and source run date is retained. Known source sizes include 109-page market history; performance parser limit is 250 pages /30MB. No original PDFs or extracted private fixtures are committed or published automatically.

Separate schema in `supabase/migrations/20261121_performance_sources.sql` is required. The session cannot apply Supabase SQL. `api/performance` publicly reads sanitized source figures with explicit pagination and size caps; PIN-cookie/same-origin writes call an atomic service-only replacement function. Replacement key is source kind + dimension + stay-date range; publishing a new accepted file replaces that dimension's dates, never accumulates duplicate snapshots. Other dimensions, history vs forecast and budgets are never overwritten. Older source-run dates and duplicate file hashes are rejected. Import metadata retained separately. Source writes and published views remain unavailable until migration is run; no successful cross-device persistence is claimed before verification.

Retail codes (from supplied Market Codes document): ADV/BAR/PKG/PRO/DAY/OTA/RET. Wholesale: ITO/LTO/GRP. Corporate, Discount, Events, Complimentary, House Use and System Use remain distinct; unknown segments unmapped. Explicit country-group lists in `performanceSources.ts` drive geographic market analysis; country mapping review table exposes every source code and assignment. Unknown and unresolved/transcontinental codes (e.g. TR) remain unmapped pending business review, never guessed. Russia/CIS, Middle East, Europe, Asia, Americas and Other groups are operational mappings, not an inferred cross-tab. No country-by-segment split is constructed from separate source dimensions.

Primary Source Analysis appears above planning data on Commercial Pulse, geographic market pages and Management Lense. Public Reports Library has Primary Reservation Source Reports and Hotel/Market/Country/Villa/Segment/Business Pace shortcuts point to the matching primary dimension/basis. Source run dates, actual coverage, monthly details, chart amounts, weighted ADR, available F&B/other revenue and CSV export are available. Views refresh every 60 seconds and immediately in the publishing session; generated legacy snapshots aren't retroactively rewritten. Forecast is reported as on-books projection, not guaranteed future realized revenue or daily pickup. ADR is total revenue / rooms; occupancy is preserved as source input but not summed/recomputed without verified denominator. Room types use their own source, never estimated from markets/countries.

Existing budget planning/legacy workbook BOB remains below a clear separator, not relabeled as primary history/forecast. Monthly/quarterly/yearly/custom budget report engine still uses that planning dataset; meal-plan inputs are not supplied in these sources. Those report types remain explicitly legacy/planning rather than being silently fed incompatible actuals. Sales attribution still not collected. This revision does not merge primary actuals into target inputs or infer annual projections from partial date ranges. The five supplied samples were privately parsed/reconciled, not preloaded into the public repository/site; admins must publish them once shared-source storage is active.
