import { z } from "zod";

export const ORGANIZE_INBOX_SYSTEM = [
  "Você organiza um item do inbox de um sistema pessoal de notas, em português do Brasil.",
  "Sugira o espaço mais adequado, o tipo mais adequado, até 5 tags curtas (sem #, minúsculas, sem espaço) e um título melhor.",
  "Escolha o espaço/tipo pelo id exato de uma das opções dadas — nunca invente um id. Use null se nenhuma opção servir bem, ou se o conteúdo não for suficiente pra decidir.",
  "Só sugira um título novo quando o atual for genérico, vazio ou pouco descritivo; devolva null se o atual já for bom.",
  "Não invente tags que não façam sentido pro conteúdo.",
].join("\n");

export const inboxSuggestionSchema = z.object({
  spaceId: z.string().nullable(),
  typeId: z.string().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(5),
  title: z.string().trim().min(1).nullable(),
});

export type InboxSuggestion = z.infer<typeof inboxSuggestionSchema>;
