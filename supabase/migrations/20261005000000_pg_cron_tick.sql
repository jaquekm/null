-- Habilita as extensões e agenda o tick de jobs (pg_cron, 2.2) a cada minuto.
--
-- Esta migration NÃO contém nenhum segredo — a query só referencia os nomes
-- 'app_url'/'cron_secret' guardados no Vault do Supabase, nunca os valores
-- de verdade. Por isso é seguro versionar (ao contrário do valor do
-- CRON_SECRET em si, que nunca pode ir pro Git).
--
-- Continua faltando um passo manual, único, feito uma vez direto no SQL
-- Editor do projeto (nunca commitado — documentado em
-- docs/configuracao-integracoes.md):
--   select vault.create_secret('<CRON_SECRET real>', 'cron_secret');
--   select vault.create_secret('<https://dominio-real>', 'app_url');
-- Sem isso, o agendamento existe mas cada execução falha silenciosamente
-- (a URL/segredo saem nulos) até o passo acima ser feito.
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
