-- Required once for shared primary history/forecast sources; rerunnable.
begin;
create table if not exists public.performance_source_imports (
 id text primary key,kind text not null check(kind in ('history','forecast')),dimension text not null check(dimension in ('market','room','country')),
 from_date date not null,to_date date not null,as_of date not null,created_at timestamptz not null default now(),check(from_date<=to_date)
);
create table if not exists public.performance_source_rows (
 kind text not null check(kind in ('history','forecast')),dimension text not null check(dimension in ('market','room','country')),
 date date not null,code text not null,data jsonb not null,as_of date not null,updated_at timestamptz not null default now(),
 primary key(kind,dimension,date,code)
);
alter table public.performance_source_imports enable row level security;
alter table public.performance_source_rows enable row level security;
revoke all on public.performance_source_imports,public.performance_source_rows from anon,authenticated;
grant select,insert,delete on public.performance_source_rows to service_role;
grant select,insert on public.performance_source_imports to service_role;
create or replace function public.publish_performance_source(p_id text,p_kind text,p_dimension text,p_from date,p_to date,p_as_of date,p_rows jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_kind not in ('history','forecast') or p_dimension not in ('market','room','country') or p_from>p_to or p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'Invalid source'; end if;
 perform pg_advisory_xact_lock(hashtext('performance:'||p_kind||':'||p_dimension));
 if exists(select 1 from public.performance_source_imports where id=p_id) or exists(select 1 from public.performance_source_rows where kind=p_kind and dimension=p_dimension and date between p_from and p_to and as_of>p_as_of) then raise exception 'Duplicate or stale source'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where (r->>'date')::date not between p_from and p_to) then raise exception 'Out of range'; end if;
 -- Replace the complete imported date range for ONE source dimension only.
 delete from public.performance_source_rows where kind=p_kind and dimension=p_dimension and date between p_from and p_to;
 insert into public.performance_source_rows(kind,dimension,date,code,data,as_of)
 select p_kind,p_dimension,(r->>'date')::date,r->>'code',r,p_as_of from jsonb_array_elements(p_rows) r;
 insert into public.performance_source_imports(id,kind,dimension,from_date,to_date,as_of) values(p_id,p_kind,p_dimension,p_from,p_to,p_as_of);
end $$;
revoke all on function public.publish_performance_source(text,text,text,date,date,date,jsonb) from public,anon,authenticated;
grant execute on function public.publish_performance_source(text,text,text,date,date,date,jsonb) to service_role;
commit;
