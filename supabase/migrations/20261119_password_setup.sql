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
