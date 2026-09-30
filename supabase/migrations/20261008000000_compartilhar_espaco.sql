-- 9.7: compartilhar um espaço inteiro (ou só uma subcategoria dele) e
-- registrar o que acontece nos links pra avisar a dona.

-- Link de espaço: `resource_type = 'space'`, `resource_id` = id do espaço.
alter table public.share_links drop constraint share_links_resource_type_check;
alter table public.share_links add constraint share_links_resource_type_check
  check (resource_type in ('item', 'list', 'split', 'report', 'bill', 'space'));

-- Subcategoria (tag) pra restringir um link de espaço — nulo = o espaço inteiro.
-- Apagar a subcategoria apaga o link (sem ela o link mostraria o espaço inteiro,
-- mais do que a dona escolheu compartilhar).
alter table public.share_links add column tag_id uuid references public.tags(id) on delete cascade;
alter table public.share_links add constraint share_links_tag_only_for_space
  check (tag_id is null or resource_type = 'space');

-- O que visitantes fazem num link (hoje: marcar/desmarcar item de checklist).
-- Comentários continuam em `share_comments`; os dois alimentam o aviso
-- "Nos seus links" no Hoje até a dona marcar como visto.
create table public.share_link_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  share_link_id uuid not null references public.share_links(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  kind text not null check (kind in ('check', 'uncheck')),
  detail text check (char_length(detail) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index share_link_events_unread_idx on public.share_link_events (owner_id, created_at desc) where read_at is null;
create index share_link_events_link_idx on public.share_link_events (share_link_id, created_at desc);
create index share_comments_unread_idx on public.share_comments (owner_id, created_at desc) where read_at is null;

alter table public.share_link_events enable row level security;
create policy "owner_all" on public.share_link_events for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
