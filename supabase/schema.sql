-- Run once in a new Supabase project as the database administrator.
-- Never expose the service-role/secret key to this application.
begin;
create table public.app_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.market_members (
 user_id uuid references auth.users(id) on delete cascade,
 market_id text check (market_id in ('asia','america','middle-east','russia')),
 primary key (user_id, market_id)
);
create table public.market_months (
 market_id text not null check (market_id in ('asia','america','middle-east','russia')),
 year integer not null check (year between 2020 and 2100),
 month integer not null check (month between 1 and 12),
 data jsonb not null,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key (market_id,year,month)
);
create table public.audit_log (
 id bigint generated always as identity primary key,
 market_id text not null,
 year integer not null,
 month integer not null,
 actor uuid references auth.users(id) on delete set null,
 changed_at timestamptz not null default now(),
 old_data jsonb,
 new_data jsonb not null
);
create index audit_market_time on public.audit_log(market_id,changed_at desc);
alter table public.app_admins enable row level security;
alter table public.market_members enable row level security;
alter table public.market_months enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.app_admins, public.market_members, public.market_months, public.audit_log from anon, authenticated;
grant select on public.market_members,public.market_months,public.audit_log to authenticated;
create function public.can_access_market(p_market text) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (
  exists(select 1 from public.app_admins a where a.user_id=auth.uid()) or
  exists(select 1 from public.market_members m where m.user_id=auth.uid() and m.market_id=p_market)
 );
$$;
revoke all on function public.can_access_market(text) from public,anon;
grant execute on function public.can_access_market(text) to authenticated;
create policy memberships_read_own on public.market_members for select to authenticated using (user_id=(select auth.uid()));
create policy months_read_assigned on public.market_months for select to authenticated using (public.can_access_market(market_id));
create policy audit_read_assigned on public.audit_log for select to authenticated using (public.can_access_market(market_id));
-- No direct insert/update/delete policies or grants: all writes go through versioned RPCs.
create function public.validate_month_data(p_data jsonb) returns void language plpgsql set search_path = '' as $$
declare section text; r jsonb; amount jsonb; arr text;
begin
 if p_data is null or jsonb_typeof(p_data) <> 'object' or jsonb_typeof(p_data->'notes') is distinct from 'string' or length(p_data->>'notes')>10000 then raise exception 'Invalid month data'; end if;
 foreach section in array array['commercial','villas','countries','meals'] loop
  if jsonb_typeof(p_data->section) is distinct from 'array' then raise exception 'Missing section %',section; end if;
  if jsonb_array_length(p_data->section)>100 then raise exception 'Too many categories'; end if;
  for r in select * from jsonb_array_elements(p_data->section) loop
   if jsonb_typeof(r->'label') is distinct from 'string' or length(r->>'label') not between 1 and 200 then raise exception 'Invalid category'; end if;
   foreach arr in array array['targets','weekly'] loop
    if jsonb_typeof(r->arr) is distinct from 'array' then raise exception 'Invalid weekly values'; end if;
    if jsonb_array_length(r->arr)<>4 then raise exception 'Four weekly values are required'; end if;
   end loop;
   for amount in select value from jsonb_array_elements(jsonb_build_array(r->'budget',r->'bob') || (r->'targets') || (r->'weekly')) loop
    if jsonb_typeof(amount) is distinct from 'number' then raise exception 'Invalid numeric value'; end if;
    if (amount::text)::numeric<0 or (amount::text)::numeric>1000000000000 then raise exception 'Numeric value out of range'; end if;
   end loop;
  end loop;
 end loop;
 if jsonb_array_length(p_data->'commercial')<>2 or p_data#>>'{commercial,0,label}' is distinct from 'Room Nights' or p_data#>>'{commercial,1,label}' is distinct from 'Room Revenue' then raise exception 'Commercial rows must be Room Nights and Room Revenue'; end if;
end;
$$;
revoke all on function public.validate_month_data(jsonb) from public,anon,authenticated;
create function public.log_month_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_log(market_id,year,month,actor,old_data,new_data)
 values(new.market_id,new.year,new.month,auth.uid(),case when tg_op='UPDATE' then old.data else null end,new.data);
 return new;
end;
$$;
revoke all on function public.log_month_change() from public,anon,authenticated;
create trigger log_market_month after insert or update on public.market_months for each row execute function public.log_month_change();
create function public.save_market_month(p_market text,p_year integer,p_month integer,p_data jsonb,p_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare current_version integer; next_version integer;
begin
 if not public.can_access_market(p_market) then raise exception 'You are not assigned to this market' using errcode='42501'; end if;
 if p_version is null or p_version<0 then raise exception 'Invalid version'; end if;
 perform public.validate_month_data(p_data);
 -- Locks even missing rows, preventing simultaneous first-save overwrites.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_market||':'||p_year||':'||p_month,0));
 select version into current_version from public.market_months where market_id=p_market and year=p_year and month=p_month;
 if coalesce(current_version,0)<>p_version then raise exception 'Another manager updated this month. Discard and reload before saving again.' using errcode='40001'; end if;
 next_version=coalesce(current_version,0)+1;
 insert into public.market_months(market_id,year,month,data,version,updated_at) values(p_market,p_year,p_month,p_data,next_version,now())
 on conflict(market_id,year,month) do update set data=excluded.data,version=excluded.version,updated_at=excluded.updated_at;
 return next_version;
end;
$$;
revoke all on function public.save_market_month(text,integer,integer,jsonb,integer) from public,anon;
grant execute on function public.save_market_month(text,integer,integer,jsonb,integer) to authenticated;
create function public.import_market_months(p_entries jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare e jsonb; first_market text; first_year integer;
begin
 if jsonb_typeof(p_entries) is distinct from 'array' then raise exception 'Expected entries'; end if;
 if jsonb_array_length(p_entries)<>12 then raise exception 'Import requires all twelve months'; end if;
 first_market=p_entries->0->>'market_id';first_year=(p_entries->0->>'year')::integer;
 if (select count(distinct (v->>'month')::integer) from jsonb_array_elements(p_entries) v)<>12 then raise exception 'Duplicate or missing month'; end if;
 -- One transaction: any conflict, invalid value or permission failure rolls back every month.
 for e in select value from jsonb_array_elements(p_entries) order by (value->>'month')::integer loop
  if (e->>'market_id') is distinct from first_market or (e->>'year')::integer is distinct from first_year then raise exception 'Import must be one market and year'; end if;
  perform public.save_market_month(e->>'market_id',(e->>'year')::integer,(e->>'month')::integer,e->'data',(e->>'version')::integer);
 end loop;
end;
$$;
revoke all on function public.import_market_months(jsonb) from public,anon;
grant execute on function public.import_market_months(jsonb) to authenticated;
commit;
