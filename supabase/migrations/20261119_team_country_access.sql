-- Run after property_setup migration. No private roster or passwords are seeded.
begin;
create table if not exists public.team_directory (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id) on delete set null,
 name text not null, position text not null default '', department text not null default '', level text not null default '', username text not null default '',
 role text not null check(role in ('Read-Only','Admin','Super Admin')),
 scope text not null check(scope in ('all','markets','india','kazakhstan')),
 markets text[] not null default '{}', version integer not null default 1,
 check(role='Read-Only' or scope='all'), check(markets <@ array['asia','america','middle-east','russia','europe']::text[])
);
alter table public.team_directory enable row level security;
revoke all on public.team_directory from anon,authenticated;
-- Auth user IDs are deliberately not exposed in the directory listing.
grant select(id,name,position,department,level,username,role,scope,markets,version) on public.team_directory to authenticated;
drop policy if exists directory_signed_in_read on public.team_directory;
create policy directory_signed_in_read on public.team_directory for select to authenticated using ((select auth.uid()) is not null);
create table if not exists public.team_audit_log(id bigint generated always as identity primary key,actor uuid,changed_at timestamptz default now(),old_data jsonb,new_data jsonb);
alter table public.team_audit_log enable row level security;
revoke all on public.team_audit_log from anon,authenticated;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and case when exists(select 1 from public.team_directory where user_id=auth.uid()) then exists(select 1 from public.team_directory where user_id=auth.uid() and role='Super Admin' and scope='all') else exists(select 1 from public.app_super_admins where user_id=auth.uid()) end;
$$;
create or replace function public.is_app_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and case when exists(select 1 from public.team_directory where user_id=auth.uid()) then exists(select 1 from public.team_directory where user_id=auth.uid() and role in ('Admin','Super Admin') and scope='all') else exists(select 1 from public.app_admins where user_id=auth.uid()) end;
$$;
create or replace function public.can_access_market(p_market text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and case when exists(select 1 from public.team_directory where user_id=auth.uid()) then exists(select 1 from public.team_directory where user_id=auth.uid() and (scope='all' or (scope='markets' and p_market=any(markets)))) else public.is_app_admin() or exists(select 1 from public.market_members where user_id=auth.uid() and market_id=p_market) end;
$$;
create or replace function public.my_financial_scope() returns text language sql stable security definer set search_path='' as $$
 select coalesce((select scope from public.team_directory where user_id=auth.uid()),'markets');
$$;
revoke all on function public.my_financial_scope() from public,anon;
grant execute on function public.my_financial_scope() to authenticated;
create or replace function public.save_team_member(p_id uuid,p_user_id uuid,p_data jsonb,p_version integer) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.team_directory%rowtype; next_id uuid; assigned uuid; old_json jsonb;
begin
 if not public.is_super_admin() then raise exception 'Super Admin access required' using errcode='42501'; end if;
 if p_version is null or p_version<0 then raise exception 'Invalid version'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or p_data ?| array['password','Password','token','secret'] then raise exception 'Passwords and credentials are not accepted'; end if;
 if length(btrim(coalesce(p_data->>'name',''))) not between 1 and 150 or length(coalesce(p_data->>'position',''))>150 or length(coalesce(p_data->>'department',''))>100 or length(coalesce(p_data->>'level',''))>10 or length(coalesce(p_data->>'username',''))>100 then raise exception 'Invalid team profile'; end if;
 if p_data->>'role' is null or p_data->>'scope' is null or jsonb_typeof(p_data->'markets') is distinct from 'array' then raise exception 'Missing permissions'; end if;
 perform pg_catalog.pg_advisory_xact_lock(8191128);
 if p_id is not null then select * into old from public.team_directory where id=p_id; if not found or old.version<>p_version then raise exception 'Team profile changed. Reload first.' using errcode='40001'; end if; else if p_version<>0 then raise exception 'Invalid version'; end if; end if;
 assigned=coalesce(p_user_id,old.user_id);
 if old.user_id=auth.uid() or assigned=auth.uid() then
  if (p_data->>'role')<>'Super Admin' or (p_data->>'scope')<>'all' or (old.user_id=auth.uid() and assigned<>auth.uid()) then raise exception 'Cannot remove your own Super Admin access'; end if;
 end if;
 old_json=case when old.id is null then null else to_jsonb(old) end;
 next_id=coalesce(p_id,gen_random_uuid());
 insert into public.team_directory(id,user_id,name,position,department,level,username,role,scope,markets,version)
 values(next_id,assigned,btrim(p_data->>'name'),coalesce(p_data->>'position',''),coalesce(p_data->>'department',''),coalesce(p_data->>'level',''),coalesce(p_data->>'username',''),p_data->>'role',p_data->>'scope',array(select jsonb_array_elements_text(p_data->'markets')),coalesce(old.version,0)+1)
 on conflict(id) do update set user_id=excluded.user_id,name=excluded.name,position=excluded.position,department=excluded.department,level=excluded.level,username=excluded.username,role=excluded.role,scope=excluded.scope,markets=excluded.markets,version=excluded.version;
 insert into public.team_audit_log(actor,old_data,new_data) select auth.uid(),old_json,to_jsonb(t) from public.team_directory t where id=next_id;
 return next_id;
end;
$$;
revoke all on function public.save_team_member(uuid,uuid,jsonb,integer) from public,anon;
grant execute on function public.save_team_member(uuid,uuid,jsonb,integer) to authenticated;
-- Explicit country financial records. Never infer revenue/nights/ADR from a country booking-count row.
create table if not exists public.country_months(country text check(country in ('india','kazakhstan')),year integer check(year between 2020 and 2100),month integer check(month between 1 and 12),data jsonb not null,version integer not null default 1,primary key(country,year,month));
alter table public.country_months enable row level security;
revoke all on public.country_months from anon,authenticated;
grant select on public.country_months to authenticated;
create or replace function public.can_access_country(p_country text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.my_financial_scope()=p_country or public.can_access_market(case when p_country='india' then 'asia' else 'russia' end));
$$;
revoke all on function public.can_access_country(text) from public,anon;
grant execute on function public.can_access_country(text) to authenticated;
drop policy if exists country_read_scope on public.country_months;
create policy country_read_scope on public.country_months for select to authenticated using(public.can_access_country(country));
create or replace function public.save_country_month(p_country text,p_year integer,p_month integer,p_data jsonb,p_version integer) returns integer language plpgsql security definer set search_path='' as $$
declare old public.country_months%rowtype; next_version integer;
begin
 if not public.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform public.validate_month_data(p_data);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('country:'||p_country||':'||p_year||':'||p_month,0));
 select * into old from public.country_months where country=p_country and year=p_year and month=p_month;
 if p_version is null or p_version<>coalesce(old.version,0) then raise exception 'Country data changed. Reload first.' using errcode='40001'; end if;
 next_version=coalesce(old.version,0)+1;
 insert into public.country_months values(p_country,p_year,p_month,p_data,next_version) on conflict(country,year,month) do update set data=excluded.data,version=excluded.version;
 insert into public.audit_log(market_id,year,month,actor,old_data,new_data) values(p_country,p_year,p_month,auth.uid(),old.data,p_data);
 return next_version;
end;
$$;
revoke all on function public.save_country_month(text,integer,integer,jsonb,integer) from public,anon;
grant execute on function public.save_country_month(text,integer,integer,jsonb,integer) to authenticated;
-- Validate new codes in property writes; preserve legacy profile shapes until edited.
create or replace function public.validate_property_codes() returns trigger language plpgsql set search_path='' as $$
declare c jsonb; codes text[]='{}';
begin
 for c in select * from jsonb_array_elements(new.data->'villaCategories') loop
  if c ? 'code' then if jsonb_typeof(c->'code') is distinct from 'string' or c->>'code' !~ '^[A-Z0-9]{1,10}$' then raise exception 'Invalid villa code'; end if; if c->>'code'=any(codes) then raise exception 'Duplicate villa code'; end if; codes=array_append(codes,c->>'code'); end if;
 end loop;
 codes='{}';
 if new.data ? 'mealPlanCodes' then
  if jsonb_typeof(new.data->'mealPlanCodes')<>'object' then raise exception 'Invalid meal plan codes'; end if;
  for c in select value from jsonb_each(new.data->'mealPlanCodes') loop
   if jsonb_typeof(c)<>'string' or c#>>'{}' !~ '^[A-Z0-9]{1,10}$' then raise exception 'Invalid meal plan code'; end if;
   if c#>>'{}'=any(codes) then raise exception 'Duplicate meal plan code'; end if; codes=array_append(codes,c#>>'{}');
  end loop;
 end if;
 return new;
end;
$$;
revoke all on function public.validate_property_codes() from public,anon,authenticated;
drop trigger if exists property_code_validation on public.property_settings;
create trigger property_code_validation before insert or update on public.property_settings for each row execute function public.validate_property_codes();
commit;
