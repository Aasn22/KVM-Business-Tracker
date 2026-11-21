-- Existing installations only; run after the BUSINESS LENSE schema.
-- Expands market allowlists, never inserts budgets or changes access policies.
begin;
alter table public.market_members drop constraint if exists market_members_market_id_check;
alter table public.market_members add constraint market_members_market_id_check
 check (market_id in ('asia','america','middle-east','russia','europe','other-markets'));
alter table public.market_months drop constraint if exists market_months_market_id_check;
alter table public.market_months add constraint market_months_market_id_check
 check (market_id in ('asia','america','middle-east','russia','europe','other-markets'));
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.team_directory'::regclass
 and contype='c' and pg_get_constraintdef(oid) like '%markets <@%' loop
  execute format('alter table public.team_directory drop constraint %I',c.conname);
 end loop;
 alter table public.team_directory add constraint team_directory_market_allowlist
 check(markets <@ array['asia','america','middle-east','russia','europe','other-markets']::text[]);
end $$;
commit;
