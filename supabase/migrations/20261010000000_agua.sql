-- 10.4: Água — total de ml bebidos por dia, pra meta diária e histórico
-- da semana no Hoje.
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  total_ml int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, day)
);

create trigger water_logs_updated_at before update on public.water_logs
  for each row execute function public.set_updated_at();

alter table public.water_logs enable row level security;
create policy "owner_all" on public.water_logs for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
