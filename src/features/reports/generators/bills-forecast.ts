import "server-only";
import { addDays, format } from "date-fns";
import type { z } from "zod";
import { computeCashProjection } from "@/features/financas/lib/cash-projection";
import { listAccountBalances, listAccounts, listBills, type BillRow } from "@/features/financas/queries";
import { formatBRL, sumCents } from "@/lib/money";
import type { ReportBlock } from "../lib/blocks";
import { baseReportParamsSchema } from "../schemas";
import type { ReportContext, ReportGenerator } from "../types";

export const billsForecastParamsSchema = baseReportParamsSchema;
export type BillsForecastParams = z.infer<typeof billsForecastParamsSchema>;

export interface BillsForecastBucket {
  days: 30 | 60 | 90;
  label: string;
  payableCents: number;
  receivableCents: number;
  projectedBalanceCents: number;
}

export interface BillsForecastData {
  today: string;
  startingBalanceCents: number;
  buckets: BillsForecastBucket[];
  upcomingPayable: BillRow[];
  upcomingReceivable: BillRow[];
}

/**
 * "Previsão de contas" (6.2b) — sempre a partir de hoje (não do período do
 * relatório, que não faz sentido pra uma previsão pra frente); reaproveita
 * `computeCashProjection` (4.12) num horizonte de 90 dias e recorta em 30/60/90.
 */
export const billsForecastReport: ReportGenerator<BillsForecastParams, BillsForecastData> = {
  kind: "bills_forecast",
  label: "Previsão de contas",
  paramsSchema: billsForecastParamsSchema,

  async collect(ctx: ReportContext<BillsForecastParams>): Promise<BillsForecastData> {
    const { supabase, params } = ctx;
    const today = format(new Date(), "yyyy-MM-dd");
    const horizonEnd = format(addDays(new Date(), 90), "yyyy-MM-dd");

    const [accounts, payableBills, receivableBills] = await Promise.all([
      listAccounts(supabase),
      listBills(supabase, { tab: "payable", spaceId: params.spaceId ?? undefined }, horizonEnd),
      listBills(supabase, { tab: "receivable", spaceId: params.spaceId ?? undefined }, horizonEnd),
    ]);
    const balances = await listAccountBalances(
      supabase,
      accounts.map((a) => a.id),
    );
    const startingBalanceCents = sumCents(accounts.filter((a) => a.includeInTotals).map((a) => balances.get(a.id) ?? 0));

    const days = Array.from({ length: 90 }, (_, i) => format(addDays(new Date(`${today}T12:00:00`), i), "yyyy-MM-dd"));
    const events = [...payableBills, ...receivableBills].map((b) => ({
      date: b.dueOn,
      amountCents: b.direction === "receivable" ? b.amountCents - b.paidCents : -(b.amountCents - b.paidCents),
    }));
    const projection = computeCashProjection(startingBalanceCents, events, days);

    const buckets: BillsForecastBucket[] = ([30, 60, 90] as const).map((n) => {
      const limit = days[n - 1]!;
      const inWindow = (b: BillRow) => b.dueOn <= limit;
      return {
        days: n,
        label: `${n} dias`,
        payableCents: sumCents(payableBills.filter(inWindow).map((b) => b.amountCents - b.paidCents)),
        receivableCents: sumCents(receivableBills.filter(inWindow).map((b) => b.amountCents - b.paidCents)),
        projectedBalanceCents: projection[n - 1]!.balanceCents,
      };
    });

    return {
      today,
      startingBalanceCents,
      buckets,
      upcomingPayable: payableBills.filter((b) => b.dueOn <= days[29]!),
      upcomingReceivable: receivableBills.filter((b) => b.dueOn <= days[29]!),
    };
  },

  title() {
    return "Previsão de contas";
  },

  toBlocks(data): ReportBlock[] {
    return [
      {
        kind: "cards",
        items: [
          { label: "Saldo hoje", value: formatBRL(data.startingBalanceCents) },
          ...data.buckets.map((b) => ({
            label: `Saldo projetado (${b.label})`,
            value: formatBRL(b.projectedBalanceCents),
            tone: b.projectedBalanceCents >= 0 ? ("emerald" as const) : ("red" as const),
          })),
        ],
      },
      {
        kind: "table",
        title: "A pagar × a receber por janela",
        columns: [
          { key: "label", label: "Janela" },
          { key: "payable", label: "A pagar", align: "right" },
          { key: "receivable", label: "A receber", align: "right" },
        ],
        rows: data.buckets.map((b) => ({ label: b.label, payable: formatBRL(-b.payableCents), receivable: formatBRL(b.receivableCents) })),
      },
      {
        kind: "list",
        title: "A pagar nos próximos 30 dias",
        rows: data.upcomingPayable.map((b) => ({ label: b.description, sublabel: `vence ${b.dueOn}`, value: formatBRL(b.amountCents - b.paidCents), tone: "red" })),
        emptyText: "Nada a pagar nos próximos 30 dias.",
      },
      {
        kind: "list",
        title: "A receber nos próximos 30 dias",
        rows: data.upcomingReceivable.map((b) => ({ label: b.description, sublabel: `vence ${b.dueOn}`, value: formatBRL(b.amountCents - b.paidCents), tone: "emerald" })),
        emptyText: "Nada a receber nos próximos 30 dias.",
      },
    ];
  },
};
