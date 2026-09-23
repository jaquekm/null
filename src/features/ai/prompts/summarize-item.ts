import { z } from "zod";

export const SUMMARIZE_ITEM_SYSTEM = [
  "Você resume o conteúdo de uma nota em português do Brasil.",
  "Devolva de 3 a 8 bullets curtos e objetivos, cobrindo só os pontos principais — sem redundância entre eles.",
  "Não invente informação que não esteja no texto. Se o texto for muito curto ou vazio de conteúdo, devolva um único bullet dizendo isso.",
].join("\n");

export const itemSummarySchema = z.object({
  bullets: z.array(z.string().trim().min(1)).min(1).max(8),
});

export type ItemSummary = z.infer<typeof itemSummarySchema>;
