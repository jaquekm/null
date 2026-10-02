import { z } from "zod";

export const NET_WORTH_KINDS = ["investimento", "divida"] as const;

export const createNetWorthItemSchema = z.object({
  kind: z.enum(NET_WORTH_KINDS),
  name: z.string().trim().min(1, "Dê um nome.").max(120),
});

export const setNetWorthSnapshotSchema = z.object({
  itemId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido."),
  valueCents: z.number().int().min(0, "Valor não pode ser negativo."),
});

/** Taxa de juros mensal de uma dívida (10.14), ex. 1.5 = 1,5% ao mês. */
export const setDebtRateSchema = z.object({
  itemId: z.string().uuid(),
  monthlyRatePercent: z.number().min(0, "Taxa não pode ser negativa.").max(100, "Taxa muito alta — confira se não digitou errado."),
});
