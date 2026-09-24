-- 7.7: segurança contínua.
--
-- 1. Corrige duas concessões de EXECUTE que ficaram amplas demais (mesmo
--    achado do advisor que gerou a 20260918163044_nucleo_security_hardening.sql,
--    revisitado agora pelo checklist de "funções security definer... sem
--    execute pra anon/authenticated quando forem internas"):
--    - `claim_jobs`: só o `service_role` (via `/api/jobs/tick`) deveria
--      conseguir chamar — nunca `anon`/`authenticated`.
--    - `refresh_item_extra_text`: chamada de verdade por ações do próprio
--      dono (corrigir transcrição, reprocessar anexo), então continua
--      liberada pra `authenticated` — só tira o acesso de `anon`, que nunca
--      deveria ter tido (concessão padrão do Postgres pra `PUBLIC`).
revoke execute on function public.claim_jobs(int) from public, anon, authenticated;

revoke execute on function public.refresh_item_extra_text(uuid) from public, anon, authenticated;
grant execute on function public.refresh_item_extra_text(uuid) to authenticated;

-- 2. Funções de introspecção pro script `pnpm security:check` — o cliente
--    supabase-js (PostgREST) não expõe `pg_catalog`/`information_schema`
--    direto, então isso vira 3 RPCs `security definer` (só assim conseguem
--    ler o catálogo inteiro, independente de RLS) com `search_path` fixo e
--    `EXECUTE` restrito ao `service_role` (a mesma regra que elas mesmas
--    checam, aplicada a si próprias).
create or replace function public.security_check_tables_without_rls()
returns table(table_name text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select c.relname::text
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;
$$;

create or replace function public.security_check_anon_policies()
returns table(table_name text, policy_name text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select schemaname || '.' || tablename, policyname
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and 'anon' = any(roles);
$$;

create or replace function public.security_check_definer_functions()
returns table(function_name text, has_search_path boolean, grants_anon boolean, grants_authenticated boolean)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    p.proname::text,
    (p.proconfig is not null and exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%')) as has_search_path,
    has_function_privilege('anon', p.oid, 'EXECUTE') as grants_anon,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as grants_authenticated
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true;
$$;

revoke execute on function public.security_check_tables_without_rls() from public, anon, authenticated;
revoke execute on function public.security_check_anon_policies() from public, anon, authenticated;
revoke execute on function public.security_check_definer_functions() from public, anon, authenticated;
