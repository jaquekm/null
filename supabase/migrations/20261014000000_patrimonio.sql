-- 10.12: Patrimônio — investimentos e dívidas no mesmo painel, evolução
-- mês a mês. Sem provedor de cotações na stack: a dona registra o valor
-- atual de cada posição quando quiser (não precisa ser todo mês); meses
-- sem registro repetem o último valor conhecido na leitura (não é regra
-- de banco, é `fillMonthlySnapshots` em código).
create table public.net_worth_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('investimento', 'divida')),
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger net_worth_items_updated_at before update on public.net_worth_items
  for each row execute function public.set_updated_at();

alter table public.net_worth_items enable row level security;
create policy "owner_all" on public.net_worth_items for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.net_worth_items(id) on delete cascade,
  month date not null,                           -- primeiro dia do mês, ex. 2026-09-01
  value_cents bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, month)
);
create index net_worth_snapshots_idx on public.net_worth_snapshots (owner_id, item_id, month desc);

create trigger net_worth_snapshots_updated_at before update on public.net_worth_snapshots
  for each row execute function public.set_updated_at();

alter table public.net_worth_snapshots enable row level security;
create policy "owner_all" on public.net_worth_snapshots for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
