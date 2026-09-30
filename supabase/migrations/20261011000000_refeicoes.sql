-- 10.8: Refeições marcáveis no Hoje — uma linha por dia, com o estado de
-- cada refeição fixa (café, almoço, lanche, jantar) em `meals` (jsonb).
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  meals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, day)
);

create trigger meal_logs_updated_at before update on public.meal_logs
  for each row execute function public.set_updated_at();

alter table public.meal_logs enable row level security;
create policy "owner_all" on public.meal_logs for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
