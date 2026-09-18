-- =========================================================
-- ESPAÇOS
-- =========================================================
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null,
  description text,
  icon text,                      -- emoji ou nome de ícone lucide
  color text,                     -- token de cor (ex.: 'emerald')
  position double precision not null default 0,
  ai_enabled boolean not null default true,   -- permite enviar conteúdo deste espaço à IA (fase 6)
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

-- FK adiada da 0.5: user_settings.default_space_id agora pode apontar para um espaço real.
alter table public.user_settings
  add constraint user_settings_default_space_id_fkey
  foreign key (default_space_id) references public.spaces(id) on delete set null;

-- =========================================================
-- TIPOS DE OBJETO
-- fields: array JSON de definições de campo (ver 1.2)
-- =========================================================
create table public.object_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,  -- null = disponível em todos os espaços
  name text not null,
  plural_name text,
  slug text not null,
  icon text,
  color text,
  fields jsonb not null default '[]'::jsonb,
  template jsonb,                 -- conteúdo Tiptap inicial ao criar item deste tipo
  title_template text,            -- ex.: 'Reunião {{date}}'
  default_view text not null default 'list',
  is_system boolean not null default false,   -- tipos criados pelo sistema/pack (não excluir sem confirmação)
  pack_key text,                  -- preenchido quando veio de um pack (fase 5)
  position double precision not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

-- =========================================================
-- ITENS
-- =========================================================
create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,   -- null enquanto está no inbox
  type_id uuid references public.object_types(id) on delete set null,
  parent_id uuid references public.items(id) on delete set null,
  title text not null default '',
  content jsonb,                  -- documento Tiptap (JSON)
  content_text text not null default '',   -- texto puro extraído do content (para busca e IA)
  extra_text text not null default '',     -- texto de anexos, OCR e transcrições (fase 2)
  properties jsonb not null default '{}'::jsonb,
  status text not null default 'inbox' check (status in ('inbox', 'active', 'archived')),
  source text,                    -- 'quick', 'web', 'share', 'api', 'voice', 'import', 'automation'
  source_url text,
  icon text,
  cover_path text,
  pinned boolean not null default false,
  position double precision not null default 0,
  search tsvector,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_owner_status_idx on public.items (owner_id, status) where deleted_at is null;
create index items_space_idx on public.items (space_id) where deleted_at is null;
create index items_type_idx on public.items (type_id) where deleted_at is null;
create index items_parent_idx on public.items (parent_id);
create index items_updated_idx on public.items (owner_id, updated_at desc);
create index items_search_idx on public.items using gin (search);
create index items_title_trgm_idx on public.items using gin (title extensions.gin_trgm_ops);
create index items_properties_idx on public.items using gin (properties jsonb_path_ops);

-- =========================================================
-- TAGS
-- =========================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,             -- sempre minúsculo, sem '#'
  color text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.item_tags (
  item_id uuid not null references public.items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);
create index item_tags_tag_idx on public.item_tags (tag_id);

-- =========================================================
-- LINKS ENTRE ITENS (bidirecionais pela consulta)
-- =========================================================
create table public.links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id uuid not null references public.items(id) on delete cascade,
  target_id uuid not null references public.items(id) on delete cascade,
  kind text not null default 'mention',   -- 'mention' (no texto), 'relation' (campo), 'canvas' (fase 5)
  field_key text,                          -- quando kind = 'relation'
  created_at timestamptz not null default now(),
  unique (source_id, target_id, kind, field_key),
  check (source_id <> target_id)
);
create index links_target_idx on public.links (target_id);

-- =========================================================
-- ANEXOS
-- =========================================================
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  storage_path text not null unique,       -- {owner_id}/{item_id|avulso}/{uuid}-{nome}
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text,
  width int,
  height int,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);
create index attachments_item_idx on public.attachments (item_id);
create index attachments_sha_idx on public.attachments (owner_id, sha256);

-- =========================================================
-- VERSÕES
-- =========================================================
create table public.item_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  title text not null,
  content jsonb,
  properties jsonb not null,
  reason text not null default 'auto' check (reason in ('auto', 'manual', 'restore', 'ai')),
  label text,
  created_at timestamptz not null default now()
);
create index item_versions_item_idx on public.item_versions (item_id, created_at desc);

-- =========================================================
-- VISÕES SALVAS
-- =========================================================
create table public.views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  type_id uuid references public.object_types(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('list', 'table', 'kanban', 'calendar', 'gallery', 'timeline')),
  config jsonb not null default '{}'::jsonb,   -- filtros, ordenação, agrupamento, colunas visíveis
  is_default boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- TOKENS DE API PESSOAIS (captura, atalhos, N8N, MCP)
-- =========================================================
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  token_prefix text not null,              -- primeiros 8 caracteres, para identificar na lista
  token_hash text not null unique,         -- sha256 hex do token
  scopes text[] not null default array['capture']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- TRIGGERS
-- =========================================================
create trigger spaces_updated_at before update on public.spaces
  for each row execute function public.set_updated_at();
create trigger object_types_updated_at before update on public.object_types
  for each row execute function public.set_updated_at();
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger views_updated_at before update on public.views
  for each row execute function public.set_updated_at();

-- Vetor de busca (português, sem acentos)
create or replace function public.items_search_update()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.search :=
    setweight(to_tsvector('portuguese', unaccent(coalesce(new.title, ''))), 'A') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(new.content_text, ''))), 'B') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(new.properties::text, ''))), 'C') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(new.extra_text, ''))), 'D');
  return new;
end;
$$;

create trigger items_search before insert or update of title, content_text, properties, extra_text
  on public.items for each row execute function public.items_search_update();

-- Snapshot automático de versão (no máximo 1 a cada 10 minutos por item)
create or replace function public.items_version_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
begin
  if (old.title is distinct from new.title)
     or (old.content is distinct from new.content)
     or (old.properties is distinct from new.properties) then
    select max(created_at) into last_at from public.item_versions where item_id = old.id;
    if last_at is null or last_at < now() - interval '10 minutes' then
      insert into public.item_versions (owner_id, item_id, title, content, properties, reason)
      values (old.owner_id, old.id, old.title, old.content, old.properties, 'auto');
    end if;
  end if;
  return new;
end;
$$;

create trigger items_version before update on public.items
  for each row execute function public.items_version_snapshot();

-- =========================================================
-- BUSCA
-- =========================================================
create or replace function public.search_items(
  q text,
  p_space_id uuid default null,
  p_type_id uuid default null,
  p_status text default null,
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  id uuid, title text, snippet text, space_id uuid, type_id uuid,
  status text, rank real, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with query as (
    select websearch_to_tsquery('portuguese', unaccent(q)) as tsq
  )
  select
    i.id,
    i.title,
    ts_headline('portuguese', i.content_text || ' ' || i.extra_text, query.tsq,
      'MaxFragments=2, MaxWords=18, MinWords=6, StartSel=<mark>, StopSel=</mark>') as snippet,
    i.space_id, i.type_id, i.status,
    (ts_rank(i.search, query.tsq) + similarity(i.title, q))::real as rank,
    i.updated_at
  from public.items i, query
  where i.deleted_at is null
    and (p_space_id is null or i.space_id = p_space_id)
    and (p_type_id is null or i.type_id = p_type_id)
    and (p_status is null or i.status = p_status)
    and (i.search @@ query.tsq or i.title % q)
  order by rank desc, i.updated_at desc
  limit p_limit offset p_offset;
$$;

-- Backlinks
create or replace function public.item_backlinks(p_item_id uuid)
returns table (id uuid, title text, kind text, field_key text, updated_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select i.id, i.title, l.kind, l.field_key, i.updated_at
  from public.links l
  join public.items i on i.id = l.source_id
  where l.target_id = p_item_id and i.deleted_at is null
  order by i.updated_at desc;
$$;

-- =========================================================
-- RLS
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['spaces','object_types','items','tags','item_tags','links','attachments','item_versions','views','api_tokens']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- =========================================================
-- STORAGE
-- =========================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
