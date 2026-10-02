-- 10.16: Log de cada "Tomei" (10.5) com hora — sem isso não tinha como saber
-- quantas doses de verdade foram tomadas numa semana, só o estoque atual.
-- Precisa pra "remédios esquecidos" da revisão semanal automática.
create table public.medication_dose_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  taken_at timestamptz not null default now()
);
create index medication_dose_logs_idx on public.medication_dose_logs (owner_id, item_id, taken_at desc);

alter table public.medication_dose_logs enable row level security;
create policy "owner_all" on public.medication_dose_logs for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
