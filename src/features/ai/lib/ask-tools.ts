import "server-only";
import { z } from "zod";
import { fetchAgendaEvents } from "@/features/agenda/actions";
import { periodBoundsUtc } from "@/features/ai/lib/period-filter";
import type { Client } from "@/features/ai/types";
import { isFinanceAiEnabled, listCategories, listTransactions } from "@/features/financas/queries";
import { computeTransactionTotals } from "@/features/financas/lib/transaction-totals";
import { getSalesTypeIds } from "@/features/sales/queries";
import { getStudyTypeIds } from "@/features/study/queries";
import { computeAccuracyRate } from "@/features/study/lib/study-stats";
import type { AskTool } from "@/lib/ai/claude";
import { formatBRL } from "@/lib/money";

const DATE_DESCRIPTION = "Data no formato AAAA-MM-DD.";

function toolError(message: string): { error: string } {
  return { error: message };
}

async function resolveCategoryId(supabase: Client, categoryName: string | undefined): Promise<{ id?: string; error?: string }> {
  if (!categoryName) return {};
  const categories = await listCategories(supabase);
  const match = categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase());
  return match ? { id: match.id } : { error: `Categoria "${categoryName}" não encontrada.` };
}

const financeSummaryInputSchema = z.object({
  from: z.string(),
  to: z.string(),
  spaceId: z.string().uuid().optional(),
  categoryName: z.string().optional(),
});

/** `finance_summary(from, to, spaceId?, categoryName?)` (6.7) — entradas, saídas e resultado do período, mesmo cálculo do painel financeiro (`computeTransactionTotals`, exclui transferência e pagamento de fatura). */
function buildFinanceSummaryTool(supabase: Client): AskTool {
  return {
    name: "finance_summary",
    description: `Resumo financeiro (entradas, saídas e resultado) num período. ${DATE_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: `Data inicial. ${DATE_DESCRIPTION}` },
        to: { type: "string", description: `Data final. ${DATE_DESCRIPTION}` },
        spaceId: { type: "string", description: "Id do espaço, opcional — sem isso, considera todos os espaços." },
        categoryName: { type: "string", description: "Nome exato de uma categoria financeira, opcional." },
      },
      required: ["from", "to"],
    },
    async execute(rawInput) {
      const input = financeSummaryInputSchema.parse(rawInput);
      const category = await resolveCategoryId(supabase, input.categoryName);
      if (category.error) return toolError(category.error);

      const rows = await listTransactions(supabase, { periodStart: input.from, periodEnd: input.to, spaceId: input.spaceId, categoryId: category.id });
      const totals = computeTransactionTotals(rows);

      return {
        from: input.from,
        to: input.to,
        transactionCount: rows.length,
        income: formatBRL(totals.incomeCents),
        expense: formatBRL(totals.expenseCents),
        result: formatBRL(totals.resultCents),
      };
    },
  };
}

const listTransactionsInputSchema = z.object({
  from: z.string(),
  to: z.string(),
  query: z.string().optional(),
  categoryName: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/** `list_transactions(from, to, query?, categoryName?, limit)` (6.7) — lançamentos individuais, pra perguntas que citam um lançamento específico em vez de só o total. */
function buildListTransactionsTool(supabase: Client): AskTool {
  return {
    name: "list_transactions",
    description: `Lista lançamentos financeiros de um período, com descrição, valor e categoria. ${DATE_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: `Data inicial. ${DATE_DESCRIPTION}` },
        to: { type: "string", description: `Data final. ${DATE_DESCRIPTION}` },
        query: { type: "string", description: "Texto pra filtrar pela descrição do lançamento, opcional." },
        categoryName: { type: "string", description: "Nome exato de uma categoria financeira, opcional." },
        limit: { type: "number", description: "Máximo de lançamentos a devolver (padrão 20, máximo 100)." },
      },
      required: ["from", "to"],
    },
    async execute(rawInput) {
      const input = listTransactionsInputSchema.parse(rawInput);
      const category = await resolveCategoryId(supabase, input.categoryName);
      if (category.error) return toolError(category.error);

      const [rows, categories] = await Promise.all([
        listTransactions(supabase, { periodStart: input.from, periodEnd: input.to, text: input.query, categoryId: category.id }),
        listCategories(supabase),
      ]);
      const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

      return {
        from: input.from,
        to: input.to,
        totalFound: rows.length,
        transactions: rows.slice(0, input.limit).map((row) => ({
          date: row.occurredOn,
          description: row.description,
          amount: formatBRL(row.amountCents),
          category: row.categoryId ? (categoryNameById.get(row.categoryId) ?? null) : null,
        })),
      };
    },
  };
}

const periodInputSchema = z.object({ from: z.string(), to: z.string() });

interface OpportunityRow {
  properties: Record<string, unknown> | null;
  updated_at: string;
}

function opportunityStage(row: OpportunityRow): string | null {
  const stage = row.properties?.stage;
  return typeof stage === "string" ? stage : null;
}

function opportunityValueCents(row: OpportunityRow): number {
  const value = row.properties?.value;
  return typeof value === "number" ? value : 0;
}

/** `sales_summary(from, to)` (6.7) — pipeline em aberto (instantâneo atual, mesmo critério do painel `/vendas`) e ganhos/perdidos cuja última mudança (`updated_at`) caiu no período. */
function buildSalesSummaryTool(supabase: Client, timezone: string): AskTool {
  return {
    name: "sales_summary",
    description: `Resumo do funil de vendas: valor em aberto e oportunidades ganhas/perdidas no período. ${DATE_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: `Data inicial. ${DATE_DESCRIPTION}` },
        to: { type: "string", description: `Data final. ${DATE_DESCRIPTION}` },
      },
      required: ["from", "to"],
    },
    async execute(rawInput) {
      const input = periodInputSchema.parse(rawInput);
      const typeIds = await getSalesTypeIds(supabase);
      if (!typeIds) return toolError("O pack de vendas (CRM) não está instalado.");

      const { data } = await supabase.from("items").select("properties, updated_at").eq("type_id", typeIds.opportunityTypeId).is("deleted_at", null);
      const rows: OpportunityRow[] = (data ?? []).map((row) => ({ properties: row.properties as Record<string, unknown> | null, updated_at: row.updated_at }));
      const bounds = periodBoundsUtc(input.from, input.to, timezone);
      const inPeriod = (row: OpportunityRow) => row.updated_at >= (bounds.startUtc ?? "") && (!bounds.endUtc || row.updated_at <= bounds.endUtc);

      const open = rows.filter((row) => opportunityStage(row) !== "ganho" && opportunityStage(row) !== "perdido");
      const wonInPeriod = rows.filter((row) => opportunityStage(row) === "ganho" && inPeriod(row));
      const lostInPeriod = rows.filter((row) => opportunityStage(row) === "perdido" && inPeriod(row));

      return {
        from: input.from,
        to: input.to,
        openCount: open.length,
        openValue: formatBRL(open.reduce((sum, row) => sum + opportunityValueCents(row), 0)),
        wonInPeriodCount: wonInPeriod.length,
        wonInPeriodValue: formatBRL(wonInPeriod.reduce((sum, row) => sum + opportunityValueCents(row), 0)),
        lostInPeriodCount: lostInPeriod.length,
      };
    },
  };
}

/** `study_summary(from, to)` (6.7) — cursos/livros concluídos e taxa de acerto de revisões no período, mesmo critério de `study-progress.ts` (6.2). */
function buildStudySummaryTool(supabase: Client, ownerId: string, timezone: string): AskTool {
  return {
    name: "study_summary",
    description: `Resumo de estudos: cursos e livros concluídos e taxa de acerto de revisões no período. ${DATE_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: `Data inicial. ${DATE_DESCRIPTION}` },
        to: { type: "string", description: `Data final. ${DATE_DESCRIPTION}` },
      },
      required: ["from", "to"],
    },
    async execute(rawInput) {
      const input = periodInputSchema.parse(rawInput);
      const typeIds = await getStudyTypeIds(supabase);
      if (!typeIds) return toolError("O pack de estudos não está instalado.");

      const bounds = periodBoundsUtc(input.from, input.to, timezone);
      const inPeriod = (updatedAt: string) => updatedAt >= (bounds.startUtc ?? "") && (!bounds.endUtc || updatedAt <= bounds.endUtc);

      const [coursesResult, booksResult, reviewLogsResult] = await Promise.all([
        typeIds.courseTypeId
          ? supabase.from("items").select("title, properties, updated_at").eq("type_id", typeIds.courseTypeId).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        typeIds.bookTypeId
          ? supabase.from("items").select("title, properties, updated_at").eq("type_id", typeIds.bookTypeId).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        supabase
          .from("review_logs")
          .select("rating")
          .eq("owner_id", ownerId)
          .gte("reviewed_at", bounds.startUtc ?? "1970-01-01T00:00:00.000Z")
          .lte("reviewed_at", bounds.endUtc ?? "9999-12-31T23:59:59.999Z"),
      ]);

      const coursesCompleted = (coursesResult.data ?? [])
        .filter((row) => (row.properties as Record<string, unknown> | null)?.status === "concluido" && inPeriod(row.updated_at))
        .map((row) => row.title || "Sem título");
      const booksCompleted = (booksResult.data ?? [])
        .filter((row) => (row.properties as Record<string, unknown> | null)?.status === "lido" && inPeriod(row.updated_at))
        .map((row) => row.title || "Sem título");
      const reviewLogs = reviewLogsResult.data ?? [];

      return {
        from: input.from,
        to: input.to,
        coursesCompleted,
        booksCompleted,
        reviewsInPeriod: reviewLogs.length,
        accuracyRatePercent: computeAccuracyRate(reviewLogs),
      };
    },
  };
}

const listItemsInputSchema = z.object({
  type: z.string(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** `list_items(type, filters, limit)` (6.7, escopo reduzido: `filters` virou só `query`, texto livre no título — o open-ended do enunciado sairia caro de validar contra os campos de cada tipo). */
function buildListItemsTool(supabase: Client): AskTool {
  return {
    name: "list_items",
    description: 'Lista itens de um tipo (ex.: "Tarefa", "Reunião", "Livro"), com filtro de texto opcional no título.',
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Nome do tipo de item (ex.: Tarefa, Reunião, Contato)." },
        query: { type: "string", description: "Texto pra filtrar pelo título, opcional." },
        limit: { type: "number", description: "Máximo de itens a devolver (padrão 20, máximo 50)." },
      },
      required: ["type"],
    },
    async execute(rawInput) {
      const input = listItemsInputSchema.parse(rawInput);

      const bySlug = await supabase.from("object_types").select("id, name").ilike("slug", input.type).maybeSingle();
      const typeRow = bySlug.data ?? (await supabase.from("object_types").select("id, name").ilike("name", input.type).maybeSingle()).data;
      if (!typeRow) return toolError(`Tipo "${input.type}" não encontrado.`);

      let query = supabase.from("items").select("id, title, status, updated_at").eq("type_id", typeRow.id).is("deleted_at", null);
      const term = input.query?.trim().replace(/[,()%]/g, "");
      if (term) query = query.ilike("title", `%${term}%`);

      const { data } = await query.order("updated_at", { ascending: false }).limit(input.limit);

      return {
        type: typeRow.name,
        items: (data ?? []).map((row) => ({ id: row.id, title: row.title || "Sem título", status: row.status, updatedAt: row.updated_at })),
      };
    },
  };
}

/** `list_events(from, to)` (6.7) — reaproveita `fetchAgendaEvents` (3.6, `/agenda`) por inteiro: eventos do Google, prazos de itens e lembretes, já mesclados. */
function buildListEventsTool(timezone: string): AskTool {
  return {
    name: "list_events",
    description: `Lista eventos da agenda (reuniões, prazos de itens, lembretes) num período. ${DATE_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: `Data inicial. ${DATE_DESCRIPTION}` },
        to: { type: "string", description: `Data final. ${DATE_DESCRIPTION}` },
      },
      required: ["from", "to"],
    },
    async execute(rawInput) {
      const input = periodInputSchema.parse(rawInput);
      const bounds = periodBoundsUtc(input.from, input.to, timezone);
      const entries = await fetchAgendaEvents(bounds.startUtc ?? new Date(0).toISOString(), bounds.endUtc ?? new Date().toISOString(), {
        events: true,
        items: true,
        reminders: true,
      });

      return {
        from: input.from,
        to: input.to,
        events: entries.map((entry) => ({ title: entry.title, start: entry.start, end: entry.end, allDay: entry.allDay, kind: entry.kind })),
      };
    },
  };
}

/**
 * Ferramentas de números (6.7, "Perguntas sobre números") — chamam funções do
 * servidor em vez de depender de trechos de texto pra contas exatas. Só
 * inclui as de finanças se o toggle de dados financeiros pra IA
 * (`financeAiEnabled`, `user_settings.preferences`) estiver ativo — mesma
 * regra de privacidade que já vale pra indexação (6.5).
 */
export async function buildAskTools(supabase: Client, ownerId: string, timezone: string): Promise<AskTool[]> {
  const financeEnabled = await isFinanceAiEnabled(supabase, ownerId);

  const tools: AskTool[] = [];
  if (financeEnabled) {
    tools.push(buildFinanceSummaryTool(supabase), buildListTransactionsTool(supabase));
  }
  tools.push(buildSalesSummaryTool(supabase, timezone), buildStudySummaryTool(supabase, ownerId, timezone), buildListItemsTool(supabase), buildListEventsTool(timezone));

  return tools;
}
