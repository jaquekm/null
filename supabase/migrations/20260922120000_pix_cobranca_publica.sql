-- 4.10: Pix e página pública de cobrança.
-- `share_links.permission` já aceita 'settle' e `resource_type` já aceita
-- 'split'/'bill' desde a migration de fundação de finanças — só faltam
-- as colunas abaixo.

-- "Já paguei" (permissão settle) numa conta a pagar/receber — mesmo padrão
-- de fin_split_shares.claimed_paid_at (não marca como quitado, só avisa o dono).
alter table public.fin_bills add column claimed_paid_at timestamptz;

-- Link de divisão é por participante (resource_id aponta pra fin_split_shares.id);
-- essa opção libera ver a divisão completa (todo mundo), não só a própria parte.
alter table public.share_links add column show_full_split boolean not null default false;
