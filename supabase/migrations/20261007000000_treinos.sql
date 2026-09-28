-- Módulo Treinos: programas de treino (A, B, C, D… com exercícios e
-- prescrição por fase — importados de um Word ou montados à mão), registro de
-- sessões (check-in, séries por exercício, fim de treino, dor na manhã
-- seguinte) e medidas semanais (peso, cintura, passos). As regras (semáforo,
-- sugestão de carga) ficam em src/features/treinos/lib.

create table public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  -- { workouts: [{ id: "A", name, exercises: [{ id, name, early, later, unit, load, sensitive, increment }] }] }
  definition jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No máximo um programa ativo por dono.
create unique index workout_programs_one_active_idx on public.workout_programs (owner_id) where active;

create trigger workout_programs_updated_at before update on public.workout_programs
  for each row execute function public.set_updated_at();

alter table public.workout_programs enable row level security;
create policy "owner_all" on public.workout_programs for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  program_id uuid references public.workout_programs(id) on delete set null,
  session_date date not null,
  program_week integer not null check (program_week >= 1),
  workout text not null check (workout ~ '^[A-Z]$'),
  sleep_hours numeric(4, 1) check (sleep_hours >= 0 and sleep_hours <= 24),
  energy smallint not null check (energy between 1 and 5),
  knee_pain_before smallint not null default 0 check (knee_pain_before between 0 and 10),
  back_pain_before smallint not null default 0 check (back_pain_before between 0 and 10),
  swelling boolean not null default false,
  sick boolean not null default false,
  traffic_light text not null check (traffic_light in ('green', 'yellow', 'red')),
  -- { "<exerciseId>": { name, load, reps: string[], rir, pain, note, skipped } } — `name` guarda o nome
  -- da época, pro histórico continuar legível se o programa mudar ou for apagado.
  exercises jsonb not null default '{}'::jsonb,
  duration_min integer check (duration_min >= 0),
  knee_pain_after smallint check (knee_pain_after between 0 and 10),
  back_pain_after smallint check (back_pain_after between 0 and 10),
  knee_pain_morning smallint check (knee_pain_morning between 0 and 10),
  back_pain_morning smallint check (back_pain_morning between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_sessions_owner_date_idx on public.workout_sessions (owner_id, session_date);

create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

alter table public.workout_sessions enable row level security;
create policy "owner_all" on public.workout_sessions for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create table public.workout_weekly (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  weight_kg numeric(5, 1) check (weight_kg > 0),
  waist_cm numeric(5, 1) check (waist_cm > 0),
  steps_avg integer check (steps_avg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, week_start)
);

create trigger workout_weekly_updated_at before update on public.workout_weekly
  for each row execute function public.set_updated_at();

alter table public.workout_weekly enable row level security;
create policy "owner_all" on public.workout_weekly for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
