-- 1.18: o trigger de versão (`items_version_snapshot`, 1.1) cria no máximo
-- uma versão automática a cada 10 minutos por item. Duas edições seguidas,
-- na mesma transação (logo, poucos milissegundos de diferença — bem menos
-- que 10 minutos), devem gerar só uma linha `reason = 'auto'`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'dono-versao-teste@exemplo.com');
insert into public.items (id, owner_id, title, status)
  values ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 'Título original', 'active');

update public.items set title = 'Primeira edição' where id = '77777777-7777-7777-7777-777777777777';

select is(
  (select count(*) from public.item_versions where item_id = '77777777-7777-7777-7777-777777777777' and reason = 'auto')::int,
  1,
  'primeira edição cria uma versão automática'
);

update public.items set title = 'Segunda edição, segundos depois' where id = '77777777-7777-7777-7777-777777777777';

select is(
  (select count(*) from public.item_versions where item_id = '77777777-7777-7777-7777-777777777777' and reason = 'auto')::int,
  1,
  'segunda edição, menos de 10 minutos depois da primeira, não cria outra versão automática'
);

select * from finish();
rollback;
