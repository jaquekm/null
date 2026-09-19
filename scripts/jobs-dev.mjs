#!/usr/bin/env node
// Chama POST /api/jobs/tick a cada 10s, pra não depender do pg_cron em
// desenvolvimento local (2.2, docs/fase-02-midia-transcricao.md). Rodar
// junto com `pnpm dev` (outro terminal): `pnpm jobs:dev`.

const APP_URL = process.env.APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const INTERVAL_MS = 10_000;

if (!APP_URL || !CRON_SECRET) {
  console.error("APP_URL e CRON_SECRET precisam estar definidos (.env.local).");
  process.exit(1);
}

async function tick() {
  const timestamp = new Date().toLocaleTimeString("pt-BR");
  try {
    const response = await fetch(`${APP_URL}/api/jobs/tick`, {
      method: "POST",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(`[${timestamp}] tick falhou (${response.status})`, body);
      return;
    }
    if (body?.processed > 0) {
      console.log(`[${timestamp}] ${body.processed} job(s) processado(s):`, body.ids);
    }
  } catch (err) {
    console.error(`[${timestamp}] erro ao chamar o tick:`, err instanceof Error ? err.message : err);
  }
}

console.log(`jobs:dev — chamando ${APP_URL}/api/jobs/tick a cada ${INTERVAL_MS / 1000}s`);
void tick();
setInterval(tick, INTERVAL_MS);
