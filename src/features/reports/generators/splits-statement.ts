import "server-only";
import { z } from "zod";
import { listContactBalances, listSplitSharesForSplits, listSplits, type SplitRow } from "@/features/financas/queries";
import { formatBRL } from "@/lib/money";
import type { ReportBlock } from "../lib/blocks";
import { baseReportParamsSchema } from "../schemas";
import type { Client, ReportContext, ReportGenerator } from "../types";

export const splitsStatementParamsSchema = baseReportParamsSchema
  .extend({
    contactId: z.string().uuid().optional(),
    groupLabel: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.contactId && !value.groupLabel) ctx.addIssue({ code: "custom", message: "Informe um contato ou um grupo.", path: ["contactId"] });
    if (value.contactId && value.groupLabel) ctx.addIssue({ code: "custom", message: "Escolha só um: contato ou grupo.", path: ["groupLabel"] });
  });
export type SplitsStatementParams = z.infer<typeof splitsStatementParamsSchema>;

export interface SplitStatementRow {
  splitId: string;
  title: string;
  occurredOn: string;
  contactId: string | null;
  contactName: string | null;
  shareCents: number;
  settledCents: number;
}

export interface SplitsStatementData {
  subjectLabel: string;
  rows: SplitStatementRow[];
  balanceCents: number;
}

/** "Extrato de divisão" (6.2b) — de um contato (via `fin_contact_balances`, 4.9) ou de um grupo (soma manual das partes por pessoa). */
export const splitsStatementReport: ReportGenerator<SplitsStatementParams, SplitsStatementData> = {
  kind: "splits_statement",
  label: "Extrato de divisão",
  paramsSchema: splitsStatementParamsSchema,

  async collect(ctx: ReportContext<SplitsStatementParams>): Promise<SplitsStatementData> {
    const { supabase, params } = ctx;

    if (params.groupLabel) {
      const splits = await listSplits(supabase, { groupLabel: params.groupLabel });
      const shares = await listSplitSharesForSplits(
        supabase,
        splits.map((s) => s.id),
      );
      const splitById = new Map<string, SplitRow>(splits.map((s) => [s.id, s]));
      const contactIds = [...new Set(shares.filter((s) => s.contactId).map((s) => s.contactId as string))];
      const names = await loadContactNames(supabase, contactIds);

      const rows: SplitStatementRow[] = shares
        .filter((share) => share.contactId)
        .map((share) => {
          const split = splitById.get(share.splitId);
          return {
            splitId: share.splitId,
            title: split?.title ?? "Divisão",
            occurredOn: split?.occurredOn ?? "",
            contactId: share.contactId,
            contactName: names.get(share.contactId!) ?? "Contato",
            shareCents: share.shareCents,
            settledCents: share.settledCents,
          };
        })
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

      const balanceCents = rows.reduce((sum, row) => sum + (row.shareCents - row.settledCents), 0);
      return { subjectLabel: `Grupo "${params.groupLabel}"`, rows, balanceCents };
    }

    const contactId = params.contactId!;
    const [splits, balances, names] = await Promise.all([listSplits(supabase), listContactBalances(supabase), loadContactNames(supabase, [contactId])]);
    const shares = await listSplitSharesForSplits(
      supabase,
      splits.map((s) => s.id),
    );
    const splitById = new Map<string, SplitRow>(splits.map((s) => [s.id, s]));
    const contactName = names.get(contactId) ?? "Contato";

    const rows: SplitStatementRow[] = shares
      .filter((share) => share.contactId === contactId)
      .map((share) => {
        const split = splitById.get(share.splitId);
        return {
          splitId: share.splitId,
          title: split?.title ?? "Divisão",
          occurredOn: split?.occurredOn ?? "",
          contactId,
          contactName,
          shareCents: share.shareCents,
          settledCents: share.settledCents,
        };
      })
      .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

    return { subjectLabel: contactName, rows, balanceCents: balances.get(contactId) ?? 0 };
  },

  title(params) {
    return `Extrato de divisão — ${params.groupLabel ?? "contato"}`;
  },

  toBlocks(data): ReportBlock[] {
    return [
      {
        kind: "cards",
        items: [{ label: "Saldo", value: formatBRL(data.balanceCents), tone: data.balanceCents >= 0 ? "emerald" : "red" }],
      },
      {
        kind: "table",
        title: data.subjectLabel,
        columns: [
          { key: "title", label: "Despesa" },
          { key: "date", label: "Data" },
          { key: "contact", label: "Pessoa" },
          { key: "share", label: "Parte", align: "right" },
          { key: "status", label: "Situação", align: "right" },
        ],
        rows: data.rows.map((row) => ({
          title: row.title,
          date: row.occurredOn,
          contact: row.contactName ?? "",
          share: formatBRL(row.shareCents),
          status: row.settledCents >= row.shareCents ? "Acertado" : formatBRL(row.shareCents - row.settledCents),
        })),
        emptyText: "Nenhuma divisão encontrada.",
      },
    ];
  },
};

async function loadContactNames(supabase: Client, contactIds: string[]): Promise<Map<string, string>> {
  if (contactIds.length === 0) return new Map();
  const { data } = await supabase.from("contacts").select("id, name, nickname").in("id", contactIds);
  return new Map((data ?? []).map((row) => [row.id, row.nickname || row.name]));
}
