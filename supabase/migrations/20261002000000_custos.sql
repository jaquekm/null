-- 7.8: custos e economia.
create table public.subscriptions_tracker (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  monthly_cost_cents bigint not null check (monthly_cost_cents >= 0),
  -- null = ainda pagando (cadastrado como "isto o Hub substitui", mas não cancelado de verdade ainda).
  canceled_at date,
  -- livre (ex.: "3.3", "7.5") — qual parte do Hub substitui essa assinatura; sem FK pra fase, não existe tabela de fases.
  replaced_in_phase text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions_tracker enable row level security;
create policy "owner_all" on public.subscriptions_tracker for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger subscriptions_tracker_updated_at before update on public.subscriptions_tracker
  for each row execute function public.set_updated_at();

-- Entrada manual mensal dos custos fixos do Hub (Supabase, Vercel, domínio, bucket de backup) —
-- os custos variáveis (IA, transcrição, embeddings, WhatsApp) já vêm de `usage_events` (2.3), sem
-- precisar de tabela nova.
create table public.hub_costs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reference_month date not null,   -- sempre o primeiro dia do mês, ex. 2026-09-01
  category text not null check (category in ('supabase', 'vercel', 'domain', 'backup_bucket', 'other')),
  amount_cents bigint not null check (amount_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, reference_month, category)
);

alter table public.hub_costs enable row level security;
create policy "owner_all" on public.hub_costs for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger hub_costs_updated_at before update on public.hub_costs
  for each row execute function public.set_updated_at();
