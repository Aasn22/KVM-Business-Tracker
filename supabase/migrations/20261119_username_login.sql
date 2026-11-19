-- Requires BUSINESS EYE team_directory and Supabase Auth. Does not create Auth users.
begin;
-- Stop on ambiguous existing usernames; never guess which identity to authenticate.
create unique index if not exists team_username_unique on public.team_directory(lower(btrim(username))) where btrim(username)<>'';
create table if not exists public.username_login_attempts(username text primary key,window_start timestamptz not null,attempts integer not null);
alter table public.username_login_attempts enable row level security;
revoke all on public.username_login_attempts from public,anon,authenticated;
create or replace function public.resolve_login_username(p_username text) returns text language plpgsql security definer set search_path='' as $$
declare normalized text; email_value text; count_attempts integer;
begin
 normalized=lower(btrim(p_username));
 if length(normalized) not between 1 and 100 then return null; end if;
 insert into public.username_login_attempts values(normalized,now(),1)
 on conflict(username) do update set
  attempts=case when public.username_login_attempts.window_start<now()-interval '15 minutes' then 1 else public.username_login_attempts.attempts+1 end,
  window_start=case when public.username_login_attempts.window_start<now()-interval '15 minutes' then now() else public.username_login_attempts.window_start end
 returning attempts into count_attempts;
 if count_attempts>10 then return null; end if;
 select u.email into email_value from public.team_directory t join auth.users u on u.id=t.user_id where lower(btrim(t.username))=normalized;
 return email_value;
end;
$$;
revoke all on function public.resolve_login_username(text) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.resolve_login_username(text) to service_role; end if; end $$;
create table if not exists public.required_password_changes(user_id uuid primary key references auth.users(id) on delete cascade,initial_hash text not null);
alter table public.required_password_changes enable row level security;
revoke all on public.required_password_changes from public,anon,authenticated;
create or replace function public.password_setup_required() returns boolean language plpgsql stable security definer set search_path='' as $$
declare required boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select coalesce(u.encrypted_password,'')='' or exists(select 1 from public.required_password_changes c where c.user_id=u.id) into required from auth.users u where u.id=auth.uid();
 if required is null then raise exception 'Account not found' using errcode='42501'; end if;
 return required;
end;
$$;
create or replace function public.complete_password_change() returns void language plpgsql security definer set search_path='' as $$
declare current_hash text; previous_hash text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select encrypted_password into current_hash from auth.users where id=auth.uid();
 if coalesce(current_hash,'')='' then raise exception 'Set a password first'; end if;
 select initial_hash into previous_hash from public.required_password_changes where user_id=auth.uid();
 if previous_hash is not null and previous_hash=current_hash then raise exception 'Password must be changed first'; end if;
 delete from public.required_password_changes where user_id=auth.uid();
end;
$$;
revoke all on function public.complete_password_change() from public,anon;
grant execute on function public.complete_password_change() to authenticated;
commit;
