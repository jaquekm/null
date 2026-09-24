-- 7.1: registro de backups (banco, arquivos, teste de restauração, exportação).
-- Só `backup_runs` aqui — `subscriptions_tracker` (também no bloco "operacao"
-- do enunciado da fase 7) fica pra quando a 7.8 (custos e economia) for
-- implementada, mesmo critério de "uma migration por tarefa" já usado em
-- toda a sessão.
create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('database', 'storage', 'restore_test', 'export')),
  status text not null check (status in ('success', 'failed')),
  size_bytes bigint,
  location text,
  detail text,
  created_at timestamptz not null default now()
);
create index backup_runs_idx on public.backup_runs (owner_id, kind, created_at desc);

alter table public.backup_runs enable row level security;
create policy "owner_all" on public.backup_runs for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
