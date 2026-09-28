-- Auditoria, onda 3: job que trava (ex.: função da Vercel morta por tempo
-- esgotado no meio de uma transcrição) voltava pra fila a cada 15 minutos
-- para sempre — `attempts` subia sem limite e o mesmo job rodava de novo sem
-- nunca terminar. Agora, travado e já sem tentativas sobrando, vira `failed`
-- com uma mensagem legível; com tentativas sobrando, volta pra fila como antes.
create or replace function public.claim_jobs(p_limit int default 5)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
     set status = 'failed',
         locked_at = null,
         finished_at = now(),
         last_error = coalesce(last_error || ' — ', '') || 'Travou sem terminar ' || attempts || ' vez(es); desisti.'
   where status = 'running'
     and locked_at < now() - interval '15 minutes'
     and attempts >= max_attempts;

  update public.jobs
     set status = 'queued', locked_at = null
   where status = 'running'
     and locked_at < now() - interval '15 minutes'
     and attempts < max_attempts;

  return query
  update public.jobs j
     set status = 'running', locked_at = now(), attempts = j.attempts + 1
   where j.id in (
     select id from public.jobs
      where status = 'queued' and run_after <= now()
      order by priority, run_after
      limit p_limit
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke all on function public.claim_jobs(int) from public, anon, authenticated;
