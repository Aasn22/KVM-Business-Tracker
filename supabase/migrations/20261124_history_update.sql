-- History Update: property-level monthly aggregates; never BOB or market allocation.
begin;
create table if not exists public.history_years (
 year integer primary key check(year between 2021 and 2060),
 version integer not null default 1,
 months jsonb not null check(jsonb_typeof(months)='array' and jsonb_array_length(months)=12),
 updated_at timestamptz not null default now()
);
alter table public.history_years enable row level security;
revoke all on public.history_years from public,anon,authenticated;
grant select on public.history_years to service_role;
create or replace function public.save_history_year(p_year integer,p_version integer,p_months jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare current_version integer;
begin
 if p_year not between 2021 and 2060 or p_version<0 or p_months is null or jsonb_typeof(p_months)<>'array' or jsonb_array_length(p_months)<>12 then raise exception 'Invalid history year'; end if;
 perform pg_advisory_xact_lock(hashtext('history:'||p_year));
 select version into current_version from public.history_years where year=p_year for update;
 if coalesce(current_version,0)<>p_version then raise exception 'History version conflict'; end if;
 insert into public.history_years(year,version,months,updated_at) values(p_year,p_version+1,p_months,now())
 on conflict(year) do update set version=excluded.version,months=excluded.months,updated_at=excluded.updated_at;
end $$;
revoke all on function public.save_history_year(integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_history_year(integer,integer,jsonb) to service_role;
commit;
