-- Run once as database owner; rerunnable. Does not touch BOB or market budgets.
begin;
create table if not exists public.operational_imports (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 kind text not null check(kind in ('cancellations','reservations')),
 from_date date not null, to_date date not null, saved_at timestamptz not null default now(),
 rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows) between 1 and 10000),
 check(from_date<=to_date)
);
alter table public.operational_imports enable row level security;
revoke all on public.operational_imports from anon, authenticated;
grant select,insert on public.operational_imports to service_role;
create or replace function public.save_operational_import(p_id text,p_kind text,p_from date,p_to date,p_rows jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_kind not in ('cancellations','reservations') or p_from>p_to then raise exception 'Invalid import'; end if;
 perform pg_advisory_xact_lock(hashtext('operational_imports:'||p_kind));
 if exists(select 1 from public.operational_imports where id=p_id or (kind=p_kind and p_from<=to_date and p_to>=from_date)) then raise exception 'Duplicate or overlapping import'; end if;
 insert into public.operational_imports(id,kind,from_date,to_date,rows) values(p_id,p_kind,p_from,p_to,p_rows);
end $$;
revoke all on function public.save_operational_import(text,text,date,date,jsonb) from public,anon,authenticated;
grant execute on function public.save_operational_import(text,text,date,date,jsonb) to service_role;
commit;
