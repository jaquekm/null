-- 4.11: Orçamentos. `fin_categories.monthly_budget_cents` já existe desde a
-- 4.2 — só falta rastrear os alertas de 80%/100% já disparados (uma vez
-- cada por categoria/mês), pra não notificar de novo a cada rodada do job.
create table public.fin_budget_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null references public.fin_categories(id) on delete cascade,
  month date not null,                          -- primeiro dia do mês, ex. 2026-09-01
  threshold smallint not null check (threshold in (80, 100)),
  notified_at timestamptz not null default now(),
  unique (category_id, month, threshold)
);

alter table public.fin_budget_alerts enable row level security;
create policy "owner_all" on public.fin_budget_alerts for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
