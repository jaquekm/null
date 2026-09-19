-- 1.18: cliente anônimo não lê nenhuma tabela do núcleo nem objetos do bucket.
--
-- Duas partes: (1) checagem estrutural — RLS está habilitado em todas as
-- tabelas do núcleo (mesma lista do loop em 20260918145833_nucleo.sql), o
-- que evita que uma tabela nova esqueça o `enable row level security`; (2)
-- checagem de comportamento — com um espaço/item/objeto de verdade criados
-- por um dono, confirma que o papel `anon` (sem `auth.uid()`) não enxerga
-- nenhuma linha, já que as policies são todas `to authenticated`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

select ok(
  (
    select bool_and(rowsecurity)
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'spaces', 'object_types', 'items', 'tags', 'item_tags',
        'links', 'attachments', 'item_versions', 'views', 'api_tokens'
      )
  ),
  'RLS habilitado em todas as tabelas do núcleo'
);

-- Fixtures, criadas como o dono da migration (bypassa RLS por ser superuser).
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'dono-rls-teste@exemplo.com');
insert into public.spaces (id, owner_id, name, slug)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Espaço teste RLS', 'espaco-teste-rls');
insert into public.items (id, owner_id, space_id, title, status)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Item teste RLS', 'active');
insert into storage.buckets (id, name) values ('attachments', 'attachments') on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner)
  values ('attachments', '11111111-1111-1111-1111-111111111111/arquivo-teste-rls.txt', '11111111-1111-1111-1111-111111111111');

select is((select count(*) from public.spaces where id = '22222222-2222-2222-2222-222222222222')::int, 1, 'fixture: espaço criado');
select is((select count(*) from public.items where id = '33333333-3333-3333-3333-333333333333')::int, 1, 'fixture: item criado');
select is((select count(*) from storage.objects where bucket_id = 'attachments' and name = '11111111-1111-1111-1111-111111111111/arquivo-teste-rls.txt')::int, 1, 'fixture: objeto criado no bucket');

set local role anon;

select is((select count(*) from public.spaces)::int, 0, 'anon não lê spaces');
select is((select count(*) from public.items)::int, 0, 'anon não lê items');
select is((select count(*) from storage.objects where bucket_id = 'attachments')::int, 0, 'anon não lê objetos do bucket');

select * from finish();
rollback;
