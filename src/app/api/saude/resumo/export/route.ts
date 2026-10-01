import { NextResponse } from "next/server";
import { getUserTimezone } from "@/features/reminders/queries";
import { getMedicalResumoData } from "@/features/medical/queries";
import { requireOwner } from "@/lib/auth";
import { todayInTimezone } from "@/lib/dates";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function list(items: { title: string; date: string; validade?: string | null }[], empty: string): string {
  if (items.length === 0) return `<p class="empty">${empty}</p>`;
  return `<ul>${items
    .map(
      (item) =>
        `<li><span class="date">${formatDate(item.date)}</span> ${escapeHtml(item.title)}${
          item.validade ? ` <span class="tag">válida até ${formatDate(item.validade)}</span>` : ""
        }</li>`,
    )
    .join("")}</ul>`;
}

/** "Resumo pra levar ao médico" (10.7): HTML pra imprimir/salvar como PDF pelo navegador — mesma técnica da 5.6 (exportar proposta). */
export async function GET() {
  const { supabase, user } = await requireOwner();
  const timezone = await getUserTimezone(supabase, user.id);
  const today = todayInTimezone(timezone);
  const data = await getMedicalResumoData(supabase, user.id, today);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Resumo de saúde</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0; }
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
  h2 { font-size: 1.05rem; margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
  ul { padding-left: 0; list-style: none; }
  li { padding: 0.35rem 0; border-bottom: 1px solid #f0f0f0; }
  .date { font-weight: 600; color: #444; margin-right: 0.5rem; }
  .tag { color: #b45309; font-size: 0.85rem; }
  .empty { color: #999; font-size: 0.9rem; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>Resumo de saúde</h1>
  <p class="meta">Gerado em ${formatDate(today)} — ${escapeHtml(user.email ?? "")}</p>

  <h2>Próximas consultas</h2>
  ${list(data.consultasProximas, "Nenhuma consulta marcada.")}

  <h2>Consultas recentes</h2>
  ${list(data.consultasPassadas, "Nenhuma consulta registrada.")}

  <h2>Exames recentes</h2>
  ${list(data.exames, "Nenhum exame registrado.")}

  <h2>Receitas</h2>
  ${list(data.receitas, "Nenhuma receita registrada.")}

  <h2>Sintomas recentes</h2>
  ${list(data.sintomas, "Nenhum sintoma registrado.")}
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
