-- 10.11: Jejum — cronômetro (início/fim) com histórico. Diferente do
-- cronômetro de Foco (10.3, só em memória até "Parar e registrar"), o
-- jejum dura horas/dias e precisa sobreviver a recarregar a página —
-- por isso a sessão ativa (`ended_at is null`) já existe no banco desde
-- "Começar jejum", não só quando termina.
create table public.fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fasting_sessions_idx on public.fasting_sessions (owner_id, started_at desc);

create trigger fasting_sessions_updated_at before update on public.fasting_sessions
  for each row execute function public.set_updated_at();

alter table public.fasting_sessions enable row level security;
create policy "owner_all" on public.fasting_sessions for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
