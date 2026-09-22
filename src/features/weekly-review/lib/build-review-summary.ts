import type { JSONContent } from "@tiptap/core";
import type { AgendaEntry } from "@/features/agenda/lib/agenda-entry";
import type { BillRow } from "@/features/financas/queries";
import type { InboxItemRow } from "@/features/items/queries";
import { formatBRL } from "@/lib/money";
import type { ProjectInProgressRow } from "../queries";

function heading(level: number, text: string): JSONContent {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
}

function bulletList(items: string[]): JSONContent {
  return { type: "bulletList", content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })) };
}

function section(title: string, empty: string, items: string[] | null, unavailable: string): JSONContent[] {
  if (items === null) return [heading(3, title), paragraph(unavailable)];
  return [heading(3, title), items.length === 0 ? paragraph(empty) : bulletList(items)];
}

export interface ReviewSummaryInput {
  inbox: InboxItemRow[];
  /** `null`: pack Projetos não instalado — passo pulado. */
  projectsInProgress: ProjectInProgressRow[] | null;
  overdueTasks: AgendaEntry[];
  nextWeekAgenda: AgendaEntry[];
  /** `null`: módulo Finanças desligado — passo pulado. */
  billsThisWeek: BillRow[] | null;
  notes: string;
}

/**
 * Monta o conteúdo (Tiptap JSON, nodes de topo) do item "Revisão semanal
 * AAAA-SS" (5.8) a partir dos 6 passos já carregados — pura e testável, sem
 * banco (quem busca os dados é `queries.ts`).
 */
export function buildReviewSummaryDoc(input: ReviewSummaryInput): JSONContent[] {
  return [
    ...section(
      "Inbox",
      "Inbox zerada.",
      input.inbox.map((item) => item.title),
      "",
    ),
    ...section("Projetos em andamento", "Nenhum projeto em andamento.", input.projectsInProgress?.map((p) => p.title) ?? null, "Pack Projetos não instalado."),
    ...section(
      "Tarefas atrasadas",
      "Nenhuma tarefa atrasada.",
      input.overdueTasks.map((task) => task.title),
      "",
    ),
    ...section(
      "Agenda da próxima semana",
      "Sem compromissos na próxima semana.",
      input.nextWeekAgenda.map((entry) => entry.title),
      "",
    ),
    ...section(
      "Contas da semana",
      "Nenhuma conta vencendo essa semana.",
      input.billsThisWeek?.map((bill) => `${bill.description} — ${formatBRL(bill.amountCents)} (venc. ${bill.dueOn})`) ?? null,
      "Módulo Finanças desligado.",
    ),
    heading(3, "Notas livres"),
    paragraph(input.notes || "—"),
  ];
}
