import { NextResponse } from "next/server";
import type { JSONContent } from "@tiptap/core";
import { renderPublicContentHtml } from "@/features/sharing/lib/render-public-content";
import { getProposalExportData, getSalesTypeIds } from "@/features/sales/queries";
import { formatBRL } from "@/lib/money";
import { requireOwner } from "@/lib/auth";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "Gerar proposta em PDF a partir de template do tipo Proposta" (5.6) — nesta fase, HTML pra imprimir (o gerador de PDF de verdade é a fase 6). */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { supabase, user } = await requireOwner();

  const typeIds = await getSalesTypeIds(supabase);
  if (!typeIds) return NextResponse.json({ error: "Pack Vendas (CRM) não instalado." }, { status: 404 });

  const data = await getProposalExportData(supabase, user.id, id, typeIds.opportunityTypeId);
  if (!data) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });

  const contentHtml = renderPublicContentHtml((data.content as JSONContent | null) ?? null);
  const clientLine = [data.contactName, data.companyName].filter(Boolean).join(" — ");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.title)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 48px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
  .meta p { margin: 0.15rem 0; }
  .value { font-size: 1.3rem; font-weight: bold; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(data.title)}</h1>
  <div class="meta">
    ${clientLine ? `<p>Para: ${escapeHtml(clientLine)}</p>` : ""}
    ${data.opportunityTitle ? `<p>Oportunidade: ${escapeHtml(data.opportunityTitle)}</p>` : ""}
    <p class="value">${formatBRL(data.valueCents)}</p>
    ${data.validUntil ? `<p>Válida até ${new Date(data.validUntil).toLocaleDateString("pt-BR")}</p>` : ""}
    ${data.status ? `<p>Status: ${escapeHtml(STATUS_LABELS[data.status] ?? data.status)}</p>` : ""}
  </div>
  <hr />
  ${contentHtml}
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
