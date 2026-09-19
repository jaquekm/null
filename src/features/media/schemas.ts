import { z } from "zod";

/** Saída estruturada do resumo de reunião (2.7). */
export const meetingSummarySchema = z.object({
  titulo_sugerido: z.string(),
  resumo: z.string(), // 1–3 parágrafos
  topicos: z.array(
    z.object({
      titulo: z.string(),
      pontos: z.array(z.string()),
      inicio: z.string().optional(), // "00:12:30"
    }),
  ),
  decisoes: z.array(z.string()),
  acoes: z.array(
    z.object({
      descricao: z.string(),
      responsavel: z.string().nullable(),
      prazo: z.string().nullable(), // "YYYY-MM-DD" quando explícito
    }),
  ),
  perguntas_em_aberto: z.array(z.string()),
  participantes_mencionados: z.array(z.string()),
});

export type MeetingSummary = z.infer<typeof meetingSummarySchema>;
