-- Run after schema.sql in a disposable/test Supabase database as its administrator.
-- Requires one existing Auth user: replace the UUID below. Everything rolls back.
begin;
insert into public.market_members(user_id,market_id) values ('11111111-1111-1111-1111-111111111111','asia');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$ begin
 if not public.can_access_market('asia') then raise exception 'Assigned market access failed'; end if;
 if public.can_access_market('russia') then raise exception 'Cross-market access allowed'; end if;
 if exists(select 1 from public.market_months where market_id='russia') then raise exception 'Cross-market read leaked'; end if;
 begin
  perform public.save_market_month('asia',2027,1,'{}'::jsonb,0);
  raise exception 'Manager write allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.market_members values ('11111111-1111-1111-1111-111111111111','russia');
  raise exception 'Self assignment allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
