-- =========================================================
-- PACKS INSTALADOS
-- =========================================================
create table public.packs_installed (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pack_key text not null,
  version text not null,
  space_id uuid references public.spaces(id) on delete set null,
  mapping jsonb not null default '{}'::jsonb,   -- chaves do pack → ids criados (tipos, visões, automações)
  installed_at timestamptz not null default now(),
  unique (owner_id, pack_key, space_id)
);

-- =========================================================
-- AUTOMAÇÕES
-- =========================================================
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default true,
  trigger jsonb not null,       -- ver 5.3
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null,       -- array de ações
  space_id uuid references public.spaces(id) on delete cascade,
  type_id uuid references public.object_types(id) on delete cascade,
  pack_key text,
  last_run_at timestamptz,
  run_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  status text not null check (status in ('success', 'skipped', 'failed')),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index automation_runs_idx on public.automation_runs (automation_id, created_at desc);

-- Evita laço infinito: registro de execuções por item em cadeia
create table public.automation_event_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  automation_id uuid not null,
  chain_id uuid not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- CANVAS
-- =========================================================
create table public.canvases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null unique references public.items(id) on delete cascade,  -- canvas é um item (tipo "Canvas")
  viewport jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.canvas_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  canvas_id uuid not null references public.canvases(id) on delete cascade,
  kind text not null check (kind in ('item', 'text', 'group', 'image', 'link', 'contact')),
  item_id uuid references public.items(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  attachment_id uuid references public.attachments(id) on delete set null,
  data jsonb not null default '{}'::jsonb,     -- texto, url, rótulo do grupo
  x double precision not null,
  y double precision not null,
  width double precision,
  height double precision,
  parent_node_id uuid references public.canvas_nodes(id) on delete set null,
  style jsonb not null default '{}'::jsonb,
  z_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index canvas_nodes_canvas_idx on public.canvas_nodes (canvas_id);
create index canvas_nodes_item_idx on public.canvas_nodes (item_id);

create table public.canvas_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  canvas_id uuid not null references public.canvases(id) on delete cascade,
  source_node_id uuid not null references public.canvas_nodes(id) on delete cascade,
  target_node_id uuid not null references public.canvas_nodes(id) on delete cascade,
  label text,
  style jsonb not null default '{}'::jsonb,
  creates_link boolean not null default false,  -- se true, espelha em links (kind='canvas')
  created_at timestamptz not null default now()
);

-- =========================================================
-- ESTUDOS: REPETIÇÃO ESPAÇADA E SESSÕES
-- =========================================================
create table public.review_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null unique references public.items(id) on delete cascade,   -- item tipo Flashcard
  deck_item_id uuid references public.items(id) on delete set null,             -- baralho/curso/plano
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'relearning')),
  due_at timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days double precision not null default 0,
  scheduled_days double precision not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  last_review_at timestamptz,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_cards_due_idx on public.review_cards (owner_id, due_at) where suspended = false;

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.review_cards(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),   -- 1 errei, 2 difícil, 3 bom, 4 fácil
  state_before text not null,
  due_before timestamptz,
  stability_after double precision,
  difficulty_after double precision,
  duration_ms int,
  reviewed_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,    -- curso, livro ou plano
  kind text not null default 'study' check (kind in ('study', 'review', 'reading', 'practice', 'class')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int,
  notes text,
  created_at timestamptz not null default now()
);
create index study_sessions_idx on public.study_sessions (owner_id, started_at desc);

-- Triggers e RLS
create trigger automations_updated_at before update on public.automations for each row execute function public.set_updated_at();
create trigger canvases_updated_at before update on public.canvases for each row execute function public.set_updated_at();
create trigger canvas_nodes_updated_at before update on public.canvas_nodes for each row execute function public.set_updated_at();
create trigger review_cards_updated_at before update on public.review_cards for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['packs_installed','automations','automation_runs','automation_event_log','canvases',
    'canvas_nodes','canvas_edges','review_cards','review_logs','study_sessions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
