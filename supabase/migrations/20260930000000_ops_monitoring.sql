-- 7.6: monitoramento e alertas.
--
-- `ops_heartbeat`: marca a última vez que `/api/jobs/tick` rodou de verdade,
-- mesmo sem nenhum job pra processar — é o que `GET /api/health?deep=1` e o
-- job `ops_daily_check` usam pra saber se o laço de jobs ainda está vivo
-- ("último tick de jobs < 5 min"). Uma linha só por dono (chave primária em
-- `owner_id`), sempre sobrescrita (`upsert`).
create table public.ops_heartbeat (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  last_tick_at timestamptz not null default now()
);

alter table public.ops_heartbeat enable row level security;
create policy "owner_all" on public.ops_heartbeat for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
