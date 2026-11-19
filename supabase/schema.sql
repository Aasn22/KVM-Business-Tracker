-- Run once in a new Supabase project as the database administrator.
-- Never expose the service-role/secret key to this application.
begin;
create table public.app_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.market_members (
 user_id uuid references auth.users(id) on delete cascade,
 market_id text check (market_id in ('asia','america','middle-east','russia','europe')),
 primary key (user_id, market_id)
);
create table public.market_months (
 market_id text not null check (market_id in ('asia','america','middle-east','russia','europe')),
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
create function public.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.app_admins where user_id=auth.uid());
$$;
revoke all on function public.is_app_admin() from public,anon;
grant execute on function public.is_app_admin() to authenticated;
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
create function public.import_market_months(p_entries jsonb) returns void language plpgsql security definer set search_path = '' as $$
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

-- Property Setup: Super Admin-only configuration
-- Run as database administrator. Existing app_admins are NOT Super Admins.
begin;
create table if not exists public.app_super_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.app_super_admins enable row level security;
revoke all on public.app_super_admins from anon,authenticated;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.app_super_admins where user_id=auth.uid());
$$;
revoke all on function public.is_super_admin() from public,anon;
grant execute on function public.is_super_admin() to authenticated;
create table if not exists public.property_settings(id integer primary key check(id=1),data jsonb not null,version integer not null default 0,updated_at timestamptz not null default now());
alter table public.property_settings enable row level security;
revoke all on public.property_settings from anon,authenticated;
grant select on public.property_settings to authenticated;
drop policy if exists property_read_authenticated on public.property_settings;
create policy property_read_authenticated on public.property_settings for select to authenticated using ((select auth.uid()) is not null);
create table if not exists public.property_audit_log(id bigint generated always as identity primary key,actor uuid references auth.users(id) on delete set null,changed_at timestamptz not null default now(),old_data jsonb,new_data jsonb not null);
alter table public.property_audit_log enable row level security;
revoke all on public.property_audit_log from anon,authenticated;
create or replace function public.save_property_settings(p_data jsonb,p_version integer) returns integer language plpgsql security definer set search_path='' as $$
declare c jsonb; current_row public.property_settings%rowtype; next_version integer;
begin
 if not public.is_super_admin() then raise exception 'Super Admin access required' using errcode='42501'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Invalid property data'; end if;
 if jsonb_typeof(p_data->'name') is distinct from 'string' or length(btrim(p_data->>'name')) not between 1 and 150 or jsonb_typeof(p_data->'address') is distinct from 'string' or length(p_data->>'address')>1000 then raise exception 'Invalid property name or address'; end if;
 if jsonb_typeof(p_data->'currency') is distinct from 'string' or (p_data->>'currency')!~'^[A-Z]{3}$' then raise exception 'Invalid currency code'; end if;
 if jsonb_typeof(p_data->'logo') is distinct from 'string' or length(p_data->>'logo')>300000 or not ((p_data->>'logo')='/kuda-villingili-logo.png' or (p_data->>'logo')~'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') then raise exception 'Invalid logo'; end if;
 if jsonb_typeof(p_data->'villaCategories') is distinct from 'array' or jsonb_typeof(p_data->'mealPlans') is distinct from 'array' then raise exception 'Invalid categories'; end if;
 if jsonb_array_length(p_data->'villaCategories') not between 1 and 50 or jsonb_array_length(p_data->'mealPlans') not between 1 and 30 then raise exception 'Invalid category count'; end if;
 for c in select * from jsonb_array_elements(p_data->'villaCategories') loop
  if jsonb_typeof(c->'name') is distinct from 'string' or length(btrim(c->>'name')) not between 1 and 150 or jsonb_typeof(c->'units') is distinct from 'number' then raise exception 'Invalid villa category'; end if;
  if (c->>'units')::numeric not between 0 and 10000 or (c->>'units')::numeric<>trunc((c->>'units')::numeric) then raise exception 'Invalid inventory'; end if;
 end loop;
 for c in select * from jsonb_array_elements(p_data->'mealPlans') loop
  if jsonb_typeof(c) is distinct from 'string' or length(btrim(c#>>'{}')) not between 1 and 150 then raise exception 'Invalid meal plan'; end if;
 end loop;
 if (select count(distinct lower(btrim(v->>'name'))) from jsonb_array_elements(p_data->'villaCategories') v)<>jsonb_array_length(p_data->'villaCategories') or (select count(distinct lower(btrim(v#>>'{}'))) from jsonb_array_elements(p_data->'mealPlans') v)<>jsonb_array_length(p_data->'mealPlans') then raise exception 'Duplicate category'; end if;
 perform pg_catalog.pg_advisory_xact_lock(8191127);
 select * into current_row from public.property_settings where id=1;
 if p_version is null or p_version<>coalesce(current_row.version,0) then raise exception 'Property settings changed. Reload before saving.' using errcode='40001'; end if;
 next_version=coalesce(current_row.version,0)+1;
 insert into public.property_settings(id,data,version,updated_at) values(1,p_data,next_version,now()) on conflict(id) do update set data=excluded.data,version=excluded.version,updated_at=excluded.updated_at;
 insert into public.property_audit_log(actor,old_data,new_data) values(auth.uid(),current_row.data,p_data);
 return next_version;
end;
$$;
revoke all on function public.save_property_settings(jsonb,integer) from public,anon;
grant execute on function public.save_property_settings(jsonb,integer) to authenticated;
commit;
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
-- Reads only the caller's password-set state, never any password/hash value.
begin;
create or replace function public.password_setup_required() returns boolean language plpgsql stable security definer set search_path='' as $$
declare required boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select coalesce(u.encrypted_password,'')='' into required from auth.users u where u.id=auth.uid();
 if required is null then raise exception 'Account not found' using errcode='42501'; end if;
 return required;
end;
$$;
revoke all on function public.password_setup_required() from public,anon;
grant execute on function public.password_setup_required() to authenticated;
commit;
