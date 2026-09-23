-- Fase 6.6: busca semântica (itens relacionados por vizinhança de vetor).
--
-- `hybrid_search` (6.1) exige `q text` pro ramo de busca por palavra-chave
-- (websearch_to_tsquery) — não serve pra "vizinhos mais próximos de um
-- embedding", que não tem nenhum texto de consulta. `related_items` é uma
-- função nova, mais direta: só KNN por vetor (pgvector `<=>`, cosseno),
-- agregado por item (menor distância entre os trechos do item candidato),
-- excluindo o próprio item de origem. Usa o mesmo índice HNSW que já existe
-- (`item_chunks_embedding_idx`, migration 6.1) — nenhum índice novo.
create or replace function public.related_items(
  p_item_id uuid,
  p_embedding extensions.vector(1024),
  p_limit int default 5
)
returns table (item_id uuid, title text, distance double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select i.id, i.title, min(c.embedding <=> p_embedding) as distance
  from public.item_chunks c
  join public.items i on i.id = c.item_id
  where c.item_id <> p_item_id
    and c.embedding is not null
    and i.deleted_at is null
  group by i.id, i.title
  order by distance asc
  limit p_limit;
$$;
