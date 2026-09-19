-- Fase 2 (Mídia), tarefa 2.1: fila de jobs, transcrições, extração de texto
-- de anexos e uso/custo de serviços externos.

-- =========================================================
-- FILA DE JOBS
-- =========================================================
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'canceled')),
  priority int not null default 100,          -- menor = mais prioritário
  attempts int not null default 0,
  max_attempts int not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  finished_at timestamptz,
  last_error text,
  result jsonb,
  dedupe_key text,                            -- evita jobs duplicados ativos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_pending_idx on public.jobs (status, priority, run_after) where status = 'queued';
create unique index jobs_dedupe_idx on public.jobs (dedupe_key) where dedupe_key is not null and status in ('queued', 'running');

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- Reserva de jobs (somente service role)
create or replace function public.claim_jobs(p_limit int default 5)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  -- devolve para a fila jobs travados há mais de 15 minutos
  update public.jobs
     set status = 'queued', locked_at = null
   where status = 'running' and locked_at < now() - interval '15 minutes';

  return query
  update public.jobs j
     set status = 'running', locked_at = now(), attempts = j.attempts + 1
   where j.id in (
     select id from public.jobs
      where status = 'queued' and run_after <= now()
      order by priority, run_after
      limit p_limit
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke all on function public.claim_jobs(int) from public, anon, authenticated;

-- Tarefas periódicas. `created_at`/`updated_at` acrescentados ao que o
-- enunciado da 2.1 (docs/fase-02-midia-transcricao.md) traz — CLAUDE.md
-- exige as duas em toda tabela editável, e esta é (enabled/payload/interval
-- mudam, e `last_enqueued_at` é atualizado a cada ciclo do tick).
create table public.job_schedules (
  kind text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  interval_seconds int not null,
  payload jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_enqueued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger job_schedules_updated_at before update on public.job_schedules
  for each row execute function public.set_updated_at();

-- =========================================================
-- TRANSCRIÇÕES
-- =========================================================
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  provider text not null,
  external_id text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  language text default 'pt',
  text text,
  segments jsonb,        -- [{ start: number, end: number, speaker: string, text: string }]
  speaker_names jsonb not null default '{}'::jsonb,   -- { "A": "João", "B": "Eu" }
  summary jsonb,         -- ver 2.7
  duration_seconds numeric,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index transcripts_item_idx on public.transcripts (item_id);

create trigger transcripts_updated_at before update on public.transcripts
  for each row execute function public.set_updated_at();

-- =========================================================
-- EXTRAÇÃO DE TEXTO DOS ANEXOS
-- =========================================================
alter table public.attachments
  add column extracted_text text,
  add column extraction_status text not null default 'none'
    check (extraction_status in ('none', 'queued', 'processing', 'done', 'failed', 'skipped')),
  add column extraction_method text,     -- 'pdf_text', 'docx', 'ai_ocr', 'plain'
  add column page_count int;

-- Recalcula items.extra_text a partir de anexos e transcrições
create or replace function public.refresh_item_extra_text(p_item_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.items i
     set extra_text = left(
       coalesce((select string_agg(a.extracted_text, E'\n\n') from public.attachments a
                  where a.item_id = p_item_id and a.extracted_text is not null), '')
       || E'\n\n' ||
       coalesce((select string_agg(t.text, E'\n\n') from public.transcripts t
                  where t.item_id = p_item_id and t.text is not null), ''),
       500000)
   where i.id = p_item_id;
$$;
revoke all on function public.refresh_item_extra_text(uuid) from public, anon, authenticated;

-- =========================================================
-- USO E CUSTO DE SERVIÇOS EXTERNOS
-- =========================================================
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,          -- 'anthropic', 'transcription', 'embeddings', 'resend', 'whatsapp'
  feature text not null,           -- 'meeting_summary', 'ocr', 'transcription', ...
  model text,
  units jsonb not null default '{}'::jsonb,   -- { input_tokens, output_tokens } ou { seconds }
  cost_usd numeric(12, 6),
  item_id uuid references public.items(id) on delete set null,
  created_at timestamptz not null default now()
);
create index usage_events_month_idx on public.usage_events (owner_id, created_at);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['jobs','job_schedules','transcripts','usage_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
