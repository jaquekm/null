import { z } from "zod";

const isoDate = z.string().describe("Data no formato AAAA-MM-DD.");
const isoDateTime = z.string().describe("Data e hora em ISO 8601 (ex.: 2026-10-01T14:00:00-03:00).");

export const searchInput = {
  query: z.string().min(1).describe("Termos de busca."),
  spaces: z.array(z.string()).optional().describe("Slugs de espaço pra restringir a busca, opcional."),
  types: z.array(z.string()).optional().describe("Slugs de tipo pra restringir a busca, opcional."),
  limit: z.number().int().min(1).max(50).default(20).describe("Máximo de itens a devolver (padrão 20, máximo 50)."),
};

export const getItemInput = {
  id: z.string().uuid().describe("Id do item."),
};

export const listItemsInput = {
  type: z.string().describe("Nome ou slug do tipo de item (ex.: Tarefa, Reunião, Contato)."),
  space: z.string().optional().describe("Slug do espaço, opcional."),
  query: z.string().optional().describe("Texto pra filtrar pelo título, opcional."),
  limit: z.number().int().min(1).max(100).default(20).describe("Máximo de itens a devolver (padrão 20, máximo 100)."),
};

export const askKnowledgeBaseInput = {
  question: z.string().min(1).describe("Pergunta em linguagem natural."),
  spaces: z.array(z.string()).optional().describe("Slugs de espaço pra restringir a busca, opcional."),
  types: z.array(z.string()).optional().describe("Slugs de tipo pra restringir a busca, opcional."),
};

export const listEventsInput = {
  from: isoDate,
  to: isoDate,
};

export const listTasksInput = {
  dueBefore: isoDate.optional().describe("Só tarefas com prazo até esta data, opcional."),
  status: z.string().optional().describe('Rótulo do status (ex.: "A fazer", "Fazendo", "Feito"), opcional.'),
  project: z.string().optional().describe("Título do projeto ligado à tarefa, opcional (só quando o pack de Projetos está instalado)."),
};

export const getContactInput = {
  name: z.string().optional().describe("Nome (ou parte dele) do contato."),
  id: z.string().uuid().optional().describe("Id do contato."),
};

export const financeSummaryInput = {
  from: isoDate,
  to: isoDate,
  space: z.string().optional().describe("Slug do espaço, opcional."),
};

export const listTransactionsInput = {
  from: isoDate,
  to: isoDate,
  query: z.string().optional().describe("Texto pra filtrar pela descrição, opcional."),
  limit: z.number().int().min(1).max(100).default(20).describe("Máximo de lançamentos a devolver (padrão 20, máximo 100)."),
};

export const createItemInput = {
  title: z.string().min(1).max(500).describe("Título do item."),
  contentMarkdown: z.string().optional().describe("Conteúdo em Markdown, opcional."),
  type: z.string().optional().describe("Nome ou slug do tipo, opcional."),
  space: z.string().optional().describe("Slug do espaço — sem isso, o item vai pro inbox."),
  tags: z.array(z.string()).optional().describe("Nomes de tag, opcional."),
  properties: z.record(z.string(), z.unknown()).optional().describe("Propriedades do tipo (chave = key do campo), opcional."),
};

export const appendToItemInput = {
  id: z.string().uuid().describe("Id do item."),
  contentMarkdown: z.string().min(1).describe("Conteúdo em Markdown a acrescentar ao final do item."),
};

export const updatePropertiesInput = {
  id: z.string().uuid().describe("Id do item."),
  properties: z.record(z.string(), z.unknown()).describe("Propriedades a atualizar (chave = key do campo)."),
};

export const createReminderForMeInput = {
  title: z.string().min(1).max(200).describe("Título do lembrete."),
  when: isoDateTime,
  message: z.string().max(1000).optional().describe("Mensagem do lembrete — sem isso, usa o título."),
};
