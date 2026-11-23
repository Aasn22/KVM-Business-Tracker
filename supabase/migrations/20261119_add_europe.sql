-- Run as the database administrator for installations created before Europe support.
-- No records, grants, assignments, or RLS policies are changed.
begin;
alter table public.market_members drop constraint if exists market_members_market_id_check;
alter table public.market_members add constraint market_members_market_id_check
 check (market_id in ('asia','america','middle-east','russia','europe'));
alter table public.market_months drop constraint if exists market_months_market_id_check;
alter table public.market_months add constraint market_months_market_id_check
 check (market_id in ('asia','america','middle-east','russia','europe'));
commit;
