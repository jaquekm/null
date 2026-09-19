-- Agendamento do tick de jobs via pg_cron (2.2, docs/fase-02-midia-transcricao.md).
--
-- NÃO é uma migration: URL e segredo mudam por ambiente (dev remoto vs.
-- produção), então isto roda manualmente, uma vez por projeto, direto no
-- SQL Editor do Supabase (ou via `mcp__Supabase__execute_sql`).
--
-- [HUMANO] antes de rodar, guardar os dois segredos no Vault:
--   select vault.create_secret('<CRON_SECRET do .env>', 'cron_secret');
--   select vault.create_secret('https://<seu-dominio>', 'app_url');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'jobs-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/jobs/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Pra desfazer: select cron.unschedule('jobs-tick');
