-- 10.14: Plano de quitação de dívidas — taxa de juros mensal por dívida
-- (`net_worth_items`, 10.12), pra sugerir ordem (bola de neve/avalanche) e
-- data prevista de quitar. Só dívida usa esta coluna; investimento fica nulo.
alter table public.net_worth_items add column monthly_rate_percent numeric(6, 3);
