-- 1.18: `search_items` encontra palavra sem acento quando o texto tem acento
-- ("reuniao" acha "reunião") — o mecanismo é `unaccent()` dos dois lados,
-- tanto ao gravar o `search` tsvector (trigger `items_search_update`, 1.1)
-- quanto ao montar a consulta (`websearch_to_tsquery('portuguese', unaccent(q))`,
-- 1.14). Roda como o dono da migration, então RLS não entra na jogada aqui
-- (isso já é coberto por rls.test.sql) — o foco é só o texto.
begin;
create extension if not exists pgtap with schema extensions;

select plan(1);

insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'dono-busca-teste@exemplo.com');
insert into public.items (id, owner_id, title, status)
  values ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'Reunião de equipe', 'active');

select ok(
  exists(select 1 from public.search_items(q => 'reuniao') where id = '55555555-5555-5555-5555-555555555555'),
  'busca por "reuniao" (sem acento) encontra item com título "Reunião" (com acento)'
);

select * from finish();
rollback;
