-- 10.x: link de edição de lista (07/10). Quem recebe o link (um por pessoa, com o
-- nome em `share_links.label`) pode adicionar itens, dar nota e editar/apagar só o
-- que ele mesmo adicionou. Não cria tabela: o autor de cada item e de cada nota
-- fica no próprio documento da lista; aqui só se amplia o que o banco aceita.

alter table public.share_links drop constraint share_links_permission_check;
alter table public.share_links add constraint share_links_permission_check
  check (permission in ('view', 'comment', 'check', 'settle', 'edit'));

-- O que acontece num link, pro cartão "Nos seus links" do Hoje: além de marcar,
-- agora adicionar, dar nota, editar e apagar item.
alter table public.share_link_events drop constraint share_link_events_kind_check;
alter table public.share_link_events add constraint share_link_events_kind_check
  check (kind in ('check', 'uncheck', 'add', 'rate', 'edit', 'delete'));
