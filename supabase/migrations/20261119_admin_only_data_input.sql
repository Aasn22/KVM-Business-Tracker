-- Apply as database administrator before using admin-only data entry in an existing installation.
-- Preserves all records, assignments, audit triggers, read policies and version checks.
begin;
create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.app_admins where user_id=auth.uid());
$$;
revoke all on function public.is_app_admin() from public,anon;
grant execute on function public.is_app_admin() to authenticated;
create or replace function public.save_market_month(p_market text,p_year integer,p_month integer,p_data jsonb,p_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare current_version integer; next_version integer;
begin
 if not public.is_app_admin() then raise exception 'Administrator access required for data input' using errcode='42501'; end if;
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
create or replace function public.import_market_months(p_entries jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare e jsonb; first_market text; first_year integer;
begin
 if not public.is_app_admin() then raise exception 'Administrator access required for imports' using errcode='42501'; end if;
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
