-- Fase 6.1: relatórios, embeddings (busca semântica), conversas com a base
-- e auditoria do servidor MCP. Dimensão do vetor: 1024 (Voyage AI
-- `voyage-3` — ver docs/decisoes.md, "Embeddings: Voyage AI").

create extension if not exists vector with schema extensions;

-- =========================================================
-- RELATÓRIOS
-- =========================================================
create table public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in (
    'finance_monthly', 'finance_category', 'bills_forecast', 'splits_statement',
    'sales_pipeline', 'projects_status', 'study_progress', 'meetings_digest',
    'weekly_review', 'custom'
  )),
  params jsonb not null default '{}'::jsonb,   -- espaço, período relativo, filtros, seções
  schedule_rrule text,                         -- null = sob demanda
  timezone text not null default 'America/Sao_Paulo',
  next_run_at timestamptz,
  deliver_to jsonb not null default '{"me": true, "contacts": []}'::jsonb,
  channels text[] not null default array['push']::text[],   -- push, email, whatsapp
  include_ai_summary boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  definition_id uuid references public.report_definitions(id) on delete set null,
  kind text not null,
  title text not null,
  period_start date,
  period_end date,
  data jsonb not null,                         -- snapshot imutável dos dados
  ai_summary text,
  pdf_attachment_id uuid references public.attachments(id) on delete set null,
  share_link_id uuid references public.share_links(id) on delete set null,
  status text not null default 'done' check (status in ('running', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now()
);
create index report_runs_idx on public.report_runs (owner_id, created_at desc);

-- =========================================================
-- EMBEDDINGS (Voyage AI voyage-3, 1024 dimensões)
-- =========================================================
create table public.item_chunks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  source text not null check (source in ('content', 'attachment', 'transcript', 'properties')),
  source_id uuid,                              -- attachment_id ou transcript_id
  chunk_index int not null,
  content text not null,
  token_estimate int not null,
  metadata jsonb not null default '{}'::jsonb, -- título do item, seção, tempo inicial da transcrição, página
  content_hash text not null,
  embedding extensions.vector(1024),
  embedding_model text,
  created_at timestamptz not null default now(),
  unique (item_id, source, source_id, chunk_index)
);
create index item_chunks_item_idx on public.item_chunks (item_id);
create index item_chunks_embedding_idx on public.item_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.items add column indexed_hash text, add column indexed_at timestamptz;

-- =========================================================
-- CONVERSAS COM A BASE
-- =========================================================
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  scope jsonb not null default '{}'::jsonb,    -- { spaceIds, typeIds, dateFrom, dateTo }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,   -- [{ n, itemId, chunkId, title, excerpt }]
  created_at timestamptz not null default now()
);

-- =========================================================
-- AUDITORIA MCP
-- =========================================================
create table public.mcp_audit (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.api_tokens(id) on delete set null,
  tool text not null,
  arguments jsonb,
  result_summary text,
  status text not null check (status in ('ok', 'denied', 'error')),
  duration_ms int,
  created_at timestamptz not null default now()
);
create index mcp_audit_idx on public.mcp_audit (owner_id, created_at desc);

-- =========================================================
-- BUSCA HÍBRIDA (texto + vetor com Reciprocal Rank Fusion)
-- =========================================================
create or replace function public.hybrid_search(
  q text,
  q_embedding extensions.vector(1024),
  p_space_ids uuid[] default null,
  p_type_ids uuid[] default null,
  p_limit int default 20
)
returns table (chunk_id uuid, item_id uuid, title text, content text, metadata jsonb, score double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with filtered_items as (
    select i.id, i.title from public.items i
    where i.deleted_at is null
      and (p_space_ids is null or i.space_id = any(p_space_ids))
      and (p_type_ids is null or i.type_id = any(p_type_ids))
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding <=> q_embedding) as rnk
    from public.item_chunks c
    join filtered_items f on f.id = c.item_id
    where c.embedding is not null
    order by c.embedding <=> q_embedding
    limit 60
  ),
  keyword as (
    select c.id,
      row_number() over (order by ts_rank(to_tsvector('portuguese', unaccent(c.content)),
        websearch_to_tsquery('portuguese', unaccent(q))) desc) as rnk
    from public.item_chunks c
    join filtered_items f on f.id = c.item_id
    where to_tsvector('portuguese', unaccent(c.content)) @@ websearch_to_tsquery('portuguese', unaccent(q))
    limit 60
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
      coalesce(1.0 / (60 + s.rnk), 0) + coalesce(1.0 / (60 + k.rnk), 0) as score
    from semantic s
    full outer join keyword k on k.id = s.id
  )
  select c.id, c.item_id, f.title, c.content, c.metadata, fused.score
  from fused
  join public.item_chunks c on c.id = fused.id
  join filtered_items f on f.id = c.item_id
  order by fused.score desc
  limit p_limit;
$$;

-- Triggers e RLS
create trigger report_definitions_updated_at before update on public.report_definitions for each row execute function public.set_updated_at();
create trigger ai_conversations_updated_at before update on public.ai_conversations for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['report_definitions','report_runs','item_chunks','ai_conversations','ai_messages','mcp_audit']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
