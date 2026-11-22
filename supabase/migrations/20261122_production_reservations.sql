-- Rerunnable production ingestion. Existing snapshots retained unless an administrator
-- explicitly imports a complete replacement for a matching arrival-date range.
begin;
create table if not exists public.production_snapshots (
 id text primary key check(id='current'),data jsonb not null,updated_at timestamptz not null default now()
);
alter table public.production_snapshots enable row level security;
revoke all on public.production_snapshots from public,anon,authenticated;
grant select,insert,update on public.production_snapshots to service_role;
create table if not exists public.production_import_audit (
 id bigint generated always as identity primary key,from_date date not null,to_date date not null,record_count integer not null,created_at timestamptz not null default now()
);
alter table public.production_import_audit enable row level security;
revoke all on public.production_import_audit from public,anon,authenticated;
create or replace function public.import_production_reservations(p_reservations jsonb,p_from date,p_to date)
returns void language plpgsql security definer set search_path = '' as $$
declare existing jsonb; retained jsonb;
begin
 if p_reservations is null or p_from is null or p_to is null or p_from>p_to or jsonb_typeof(p_reservations)<>'array' or jsonb_array_length(p_reservations)=0 or jsonb_array_length(p_reservations)>50000 then raise exception 'Invalid import'; end if;
 if exists(select 1 from jsonb_array_elements(p_reservations) r where (r->>'arrival')::date is null or (r->>'arrival')::date not between p_from and p_to) then raise exception 'Arrival outside replacement range'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('production-reservations-import'));
 select data into existing from public.production_snapshots where id='current' for update;
 -- Never silently discard an older aggregate-only database snapshot.
 if existing is not null and not (existing ? 'reservations') then raise exception 'Legacy database snapshot requires reviewed migration before record import'; end if;
 select coalesce(pg_catalog.jsonb_agg(r),'[]'::jsonb) into retained from pg_catalog.jsonb_array_elements(coalesce(existing->'reservations','[]'::jsonb)) r where (r->>'arrival')::date < p_from or (r->>'arrival')::date > p_to;
 if pg_catalog.jsonb_array_length(retained)+pg_catalog.jsonb_array_length(p_reservations)>50000 then raise exception 'Stored history exceeds 50000 records; archive needed'; end if;
 insert into public.production_snapshots(id,data,updated_at) values('current',pg_catalog.jsonb_build_object('schema',2,'reservations',retained||p_reservations),now()) on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;
 insert into public.production_import_audit(from_date,to_date,record_count) values(p_from,p_to,pg_catalog.jsonb_array_length(p_reservations));
end $$;
revoke all on function public.import_production_reservations(jsonb,date,date) from public,anon,authenticated;
grant execute on function public.import_production_reservations(jsonb,date,date) to service_role;
commit;
