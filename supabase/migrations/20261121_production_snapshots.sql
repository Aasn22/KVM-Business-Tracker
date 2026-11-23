-- Shared sanitized reservation production aggregates only. Rerunnable.
begin;
create table if not exists public.production_snapshots (
 id text primary key check (id = 'current'),
 data jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.production_snapshots enable row level security;
revoke all on public.production_snapshots from public,anon,authenticated;
grant select,insert,update on public.production_snapshots to service_role;
commit;
-- All public reads and PIN-protected writes use the server allowlist.
-- Publishing replaces the current analytical snapshot, not cumulative snapshots.
