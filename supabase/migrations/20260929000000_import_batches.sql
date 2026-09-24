-- 7.5: importação de outros apps (Evernote, Notion, Obsidian, Google Keep, .ics).
--
-- `import_batches`: registro genérico de um lote de itens importados, pra
-- permitir "desfazer" (7.5: "itens marcados com properties._import_id ou
-- tabela de lote" — aqui as duas coisas juntas: os itens levam
-- `properties._import_id = <id deste lote>`, e o lote guarda os contadores
-- pro relatório final e pro botão "Desfazer").
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null check (source in ('evernote', 'obsidian', 'google_keep', 'ics')),
  status text not null default 'imported' check (status in ('imported', 'undone')),
  items_created int not null default 0,
  items_skipped int not null default 0,
  -- Pros lotes de item (evernote/obsidian/google_keep), sem uso — o "desfazer"
  -- encontra os itens de volta por `properties._import_id = id` (índice gin
  -- de `items.properties` já existe desde a fundação). Pro lote de `.ics`
  -- (que cria linhas em `events`, não em `items`, sem coluna própria pra
  -- marcar o lote), guarda `{ "eventIds": [...] }` — é o único jeito de
  -- desfazer sem migration nova em `events`.
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.import_batches enable row level security;
create policy "owner_all" on public.import_batches for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- `calendars.connection_id` deixa de ser obrigatório: a importação de `.ics`
-- (7.5, "calendário local 'Importado'") cria um calendário sem nenhuma
-- conexão do Google por trás — só um agrupador pros eventos importados.
-- `calendar_sync`/`calendar_push` (3.5) nunca tocam essas linhas: o sync só
-- olha `sync_enabled = true` (a importada nasce com `false`), e o push só é
-- enfileirado pelas ações de criar/editar/excluir evento da agenda, nunca
-- pela importação.
alter table public.calendars alter column connection_id drop not null;
