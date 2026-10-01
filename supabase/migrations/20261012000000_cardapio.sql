-- 10.9: Cardápio da semana — um plano por semana, com o que comer em cada
-- dia × refeição. `plan` guarda `{ "MO": { "cafe": "...", "almoco": "..." }, ... }`.
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, week_start)
);

create trigger meal_plans_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();

alter table public.meal_plans enable row level security;
create policy "owner_all" on public.meal_plans for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
