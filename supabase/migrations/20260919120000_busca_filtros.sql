-- Tarefa 1.14 (Busca): acrescenta filtro por tag e por período de atualização
-- a `search_items`. `create or replace function` não troca o número de
-- parâmetros de uma função existente — cria uma sobrecarga nova ao lado da
-- antiga (visto na prática ao aplicar isso: `search_items` ficou com duas
-- versões, 6 e 9 argumentos, e chamadas por nome ficaram ambíguas). Por isso
-- a antiga (6 args) precisa ser removida explicitamente antes de recriar.
drop function if exists public.search_items(text, uuid, uuid, text, integer, integer);

create or replace function public.search_items(
  q text,
  p_space_id uuid default null,
  p_type_id uuid default null,
  p_status text default null,
  p_limit int default 30,
  p_offset int default 0,
  p_tag_id uuid default null,
  p_updated_after timestamptz default null,
  p_updated_before timestamptz default null
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
    and (p_tag_id is null or exists (
      select 1 from public.item_tags it where it.item_id = i.id and it.tag_id = p_tag_id
    ))
    and (p_updated_after is null or i.updated_at >= p_updated_after)
    and (p_updated_before is null or i.updated_at <= p_updated_before)
    -- q vazio (busca só por #tag, sem mais texto) vira "listar pelos outros filtros",
    -- sem exigir nenhum match de texto — usado pela busca por tag na caixa de texto (1.14).
    and (q = '' or i.search @@ query.tsq or i.title % q)
  order by rank desc, i.updated_at desc
  limit p_limit offset p_offset;
$$;
