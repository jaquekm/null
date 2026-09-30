-- 10.3: Modo foco — cronômetro (pomodoro 25/5 ou livre) ligado a uma
-- tarefa ou projeto, pra saber depois "onde foi meu tempo" na semana.
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  mode text not null default 'livre' check (mode in ('pomodoro', 'livre')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int,
  created_at timestamptz not null default now()
);
create index focus_sessions_idx on public.focus_sessions (owner_id, started_at desc);

alter table public.focus_sessions enable row level security;
create policy "owner_all" on public.focus_sessions for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
