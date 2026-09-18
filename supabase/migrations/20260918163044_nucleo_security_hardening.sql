-- Correções apontadas pelo advisor de segurança do Supabase logo após aplicar
-- a 1.1 (ver docs/decisoes.md, 2026-09-18):
--
-- 1. `set_updated_at()` (criada na 0.5) não fixava `search_path`, o que permite
--    a um autor malicioso de outro schema "sequestrar" a função trocando o
--    `search_path` da sessão. Nenhuma das funções da 1.1 tinha esse problema
--    (todas já usam `set search_path = ...`), só essa ficou pra trás.
-- 2. `items_version_snapshot()` é `security definer` (precisa ser, pra gravar em
--    item_versions mesmo quando quem edita o item não tem policy de insert lá),
--    mas por padrão qualquer usuário autenticado (e até anônimo) pode chamá-la
--    direto via `/rest/v1/rpc/items_version_snapshot`, fora do contexto de
--    trigger — não é pra isso que ela existe. Revogar o EXECUTE público não
--    quebra o trigger (triggers não passam pela checagem de GRANT/EXECUTE).

alter function public.set_updated_at() set search_path = public, pg_temp;

revoke execute on function public.items_version_snapshot() from public, anon, authenticated;
