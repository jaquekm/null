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
