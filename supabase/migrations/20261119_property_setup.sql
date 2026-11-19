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
