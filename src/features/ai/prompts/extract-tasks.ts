import { z } from "zod";

export const EXTRACT_TASKS_SYSTEM = [
  "Você extrai tarefas acionáveis do conteúdo de uma nota, em português do Brasil.",
  "Cada tarefa é uma ação clara e específica que alguém precisa fazer — não decisões já tomadas, nem informações passivas.",
  "Detecte um prazo (data) só quando estiver explícito ou claramente inferível do texto (ex.: \"até sexta\", \"dia 20\"); use null quando não houver prazo nenhum.",
  "A data de hoje será informada no contexto — use-a como referência pra resolver datas relativas em datas absolutas, formato AAAA-MM-DD.",
  "Se não houver nenhuma tarefa clara no texto, devolva uma lista vazia.",
].join("\n");

export const extractedTaskSchema = z.object({
  descricao: z.string().trim().min(1),
  prazo: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const extractTasksSchema = z.object({
  tarefas: z.array(extractedTaskSchema).max(20),
});

export type ExtractedTask = z.infer<typeof extractedTaskSchema>;
export type ExtractTasksResult = z.infer<typeof extractTasksSchema>;
