#!/usr/bin/env node
// `pnpm security:check` (7.7) — checklist executável de segurança. Roda
// fora do app Next.js (script `.mjs` puro, como `jobs-dev.mjs`), lendo
// `process.env` direto — pra rodar local (`node --env-file=.env.local
// scripts/security-check.mjs`) ou em CI, com as variáveis já exportadas.
//
// Itens do enunciado cobertos aqui: RLS em toda tabela, nenhuma policy pra
// `anon`, funções `security definer` com `search_path` e sem `execute` pra
// anon/authenticated fora da lista permitida, bucket `attachments` privado,
// nenhuma chave secreta no bundle do cliente, cabeçalhos de segurança
// presentes, rotas públicas exigem segredo/token. "Cadastro público
// desativado" fica como lembrete manual (o próprio enunciado admite que é
// verificação manual — não tem RPC/API pra isso via supabase-js).

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const failures = [];
const oks = [];

function fail(label, detail) {
  failures.push({ label, detail });
}
function ok(label, detail) {
  oks.push({ label, detail });
}

// Funções `security definer` que legitimamente continuam liberadas pra
// `authenticated` (chamadas por ações do próprio dono, não só de dentro de
// trigger/service role) — qualquer outra achando `grants_authenticated` ou
// `grants_anon` reprova. Ver migration 20261001000000_security_check.sql.
const ALLOWED_AUTHENTICATED_DEFINER_FUNCTIONS = new Set(["refresh_item_extra_text"]);

async function checkDatabase() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    fail("banco", "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas — pulei todos os checks de banco.");
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: tablesWithoutRls, error: rlsError } = await admin.rpc("security_check_tables_without_rls");
  if (rlsError) fail("RLS", `não consegui checar: ${rlsError.message}`);
  else if (tablesWithoutRls.length > 0) fail("RLS", `tabela(s) sem RLS: ${tablesWithoutRls.map((t) => t.table_name).join(", ")}`);
  else ok("RLS", "todas as tabelas de public têm RLS habilitado.");

  const { data: anonPolicies, error: anonError } = await admin.rpc("security_check_anon_policies");
  if (anonError) fail("policies-anon", `não consegui checar: ${anonError.message}`);
  else if (anonPolicies.length > 0) fail("policies-anon", `policy(s) permitindo anon: ${anonPolicies.map((p) => `${p.table_name}.${p.policy_name}`).join(", ")}`);
  else ok("policies-anon", "nenhuma policy permite anon.");

  const { data: definerFns, error: definerError } = await admin.rpc("security_check_definer_functions");
  if (definerError) {
    fail("funcoes-security-definer", `não consegui checar: ${definerError.message}`);
  } else {
    const problems = definerFns.filter((fn) => {
      if (!fn.has_search_path) return true;
      if (fn.grants_anon) return true;
      if (fn.grants_authenticated && !ALLOWED_AUTHENTICATED_DEFINER_FUNCTIONS.has(fn.function_name)) return true;
      return false;
    });
    if (problems.length > 0) {
      fail(
        "funcoes-security-definer",
        problems.map((fn) => `${fn.function_name} (search_path=${fn.has_search_path}, anon=${fn.grants_anon}, authenticated=${fn.grants_authenticated})`).join("; "),
      );
    } else {
      ok("funcoes-security-definer", `${definerFns.length} função(ões) security definer, todas com search_path e sem execute indevido.`);
    }
  }

  const { data: bucket, error: bucketError } = await admin.storage.getBucket("attachments");
  if (bucketError) fail("bucket-attachments", `não consegui checar: ${bucketError.message}`);
  else if (bucket?.public) fail("bucket-attachments", "o bucket attachments está PÚBLICO.");
  else ok("bucket-attachments", "bucket attachments é privado.");
}

const SECURITY_HEADER_KEYS = ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Content-Security-Policy", "Permissions-Policy"];

function checkSecurityHeaders() {
  const configPath = path.join(projectRoot, "next.config.ts");
  const source = readFileSync(configPath, "utf-8");
  const missing = SECURITY_HEADER_KEYS.filter((key) => !source.includes(`"${key}"`));
  if (missing.length > 0) fail("cabecalhos-seguranca", `next.config.ts não define: ${missing.join(", ")}`);
  else ok("cabecalhos-seguranca", `next.config.ts define os ${SECURITY_HEADER_KEYS.length} cabeçalhos esperados.`);
}

// Rotas públicas (sem sessão) e o texto que precisa aparecer no arquivo,
// provando que ela valida segredo/assinatura/token antes de fazer qualquer
// trabalho — regressão-guarda simples, não uma análise estática de verdade.
const PUBLIC_ROUTES = [
  { file: "src/app/api/jobs/tick/route.ts", marker: "CRON_SECRET" },
  { file: "src/app/api/ops/backup-report/route.ts", marker: "BACKUP_REPORT_SECRET" },
  { file: "src/app/api/capture/route.ts", marker: "verifyApiToken" },
  { file: "src/app/api/webhooks/transcription/route.ts", marker: "verifyWebhook" },
  { file: "src/app/api/webhooks/messaging/route.ts", marker: "safeEqual" },
  { file: "src/app/api/health/route.ts", marker: "CRON_SECRET" },
  { file: "src/app/api/mcp/route.ts", marker: "verifyApiTokenAnyScope" },
];

function checkPublicRoutesRequireAuth() {
  const missing = [];
  for (const route of PUBLIC_ROUTES) {
    const fullPath = path.join(projectRoot, route.file);
    if (!existsSync(fullPath)) {
      missing.push(`${route.file} (arquivo não encontrado)`);
      continue;
    }
    const source = readFileSync(fullPath, "utf-8");
    if (!source.includes(route.marker)) missing.push(`${route.file} (sem "${route.marker}")`);
  }
  if (missing.length > 0) fail("rotas-publicas", missing.join("; "));
  else ok("rotas-publicas", `${PUBLIC_ROUTES.length} rota(s) pública(s) conferida(s), todas exigem segredo/token.`);
}

// Nomes de variável cujo VALOR configurado nunca deveria aparecer no bundle
// do navegador — só entram na lista as que o ambiente atual tem preenchidas
// (procurar por uma string vazia não faz sentido).
const SECRET_ENV_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
  "ENCRYPTION_KEY_PREVIOUS",
  "CRON_SECRET",
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "N8N_WEBHOOK_SECRET",
  "BACKUP_REPORT_SECRET",
  "SENTRY_AUTH_TOKEN",
  "TRANSCRIPTION_WEBHOOK_SECRET",
];

function listFilesRecursive(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) files.push(...listFilesRecursive(fullPath));
    else if (entry.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

function checkNoSecretsInClientBundle() {
  const clientDir = path.join(projectRoot, ".next", "static");
  if (!existsSync(clientDir)) {
    fail("segredos-no-bundle", "`.next/static` não existe — rode `pnpm build` antes de `pnpm security:check` pra este item valer.");
    return;
  }

  const configuredSecrets = SECRET_ENV_VARS.filter((name) => process.env[name] && process.env[name].length >= 8);
  if (configuredSecrets.length === 0) {
    ok("segredos-no-bundle", "nenhuma variável secreta configurada neste ambiente pra checar (ok em dev sem segredos reais).");
    return;
  }

  const files = listFilesRecursive(clientDir);
  const leaked = [];
  for (const name of configuredSecrets) {
    const value = process.env[name];
    for (const file of files) {
      if (readFileSync(file, "utf-8").includes(value)) {
        leaked.push(`${name} apareceu em ${path.relative(projectRoot, file)}`);
        break;
      }
    }
  }

  if (leaked.length > 0) fail("segredos-no-bundle", leaked.join("; "));
  else ok("segredos-no-bundle", `nenhum dos ${configuredSecrets.length} segredo(s) configurado(s) apareceu no bundle do cliente (${files.length} arquivo(s) verificado(s)).`);
}

async function main() {
  await checkDatabase();
  checkSecurityHeaders();
  checkPublicRoutesRequireAuth();
  checkNoSecretsInClientBundle();

  console.log("\n=== pnpm security:check ===\n");
  for (const item of oks) console.log(`  OK   ${item.label}: ${item.detail}`);
  for (const item of failures) console.log(`  FALHA ${item.label}: ${item.detail}`);

  console.log("\n[MANUAL] Cadastro público desativado — confira em Authentication → Providers → Email → \"Allow new users to sign up\" (deve estar desligado) no dashboard do Supabase. Nenhum jeito automático de checar isso por aqui.");
  console.log("[MANUAL] Rode também o Security Advisor do Supabase (dashboard → Advisors → Security) e corrija os avisos.");

  if (failures.length > 0) {
    console.error(`\n${failures.length} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nTudo certo.");
}

main().catch((err) => {
  console.error("security:check quebrou:", err);
  process.exit(1);
});
