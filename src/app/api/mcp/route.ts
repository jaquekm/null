import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getUserTimezone } from "@/features/agenda/queries";
import { logMcpCall } from "@/features/mcp/lib/audit";
import { isMcpRateLimited } from "@/features/mcp/lib/rate-limit";
import {
  mcpAskKnowledgeBase,
  mcpFinanceSummary,
  mcpGetContact,
  mcpGetItem,
  mcpListEvents,
  mcpListItems,
  mcpListSpacesAndTypes,
  mcpListTasks,
  mcpListTransactions,
  mcpSearch,
} from "@/features/mcp/lib/read-tools";
import { mcpAppendToItem, mcpCreateItem, mcpCreateReminderForMe, mcpUpdateProperties } from "@/features/mcp/lib/write-tools";
import {
  appendToItemInput,
  askKnowledgeBaseInput,
  createItemInput,
  createReminderForMeInput,
  financeSummaryInput,
  getContactInput,
  getItemInput,
  listEventsInput,
  listItemsInput,
  listTasksInput,
  listTransactionsInput,
  searchInput,
  updatePropertiesInput,
} from "@/features/mcp/schemas";
import type { McpContext } from "@/features/mcp/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyApiTokenAnyScope } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const MCP_SCOPES = ["mcp:read", "mcp:write", "finance:read"] as const;
type McpScope = (typeof MCP_SCOPES)[number];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/**
 * Auditoria + tratamento de erro em torno de uma chamada de ferramenta (6.9:
 * "toda chamada gravada em mcp_audit") — sem generics amarrados ao shape de
 * entrada de propósito: o SDK infere `Args` de cada `.tool()` a partir do
 * shape literal passado ali mesmo (`searchInput`, `getItemInput`...); passar
 * esse shape por dentro de uma função genérica própria faz o TypeScript
 * perder a identidade das chaves literais (vira `Record<string, unknown>`
 * largo demais pra bater com o tipo que cada ferramenta espera) — por isso
 * cada `server.tool(...)` abaixo chama a ferramenta direto, e só o
 * resultado passa por aqui.
 */
async function wrapCall(ctx: McpContext, tokenId: string, tool: string, args: unknown, run: () => Promise<unknown>) {
  const startedAt = Date.now();
  try {
    const result = await run();
    void logMcpCall(ctx.admin, { ownerId: ctx.ownerId, tokenId, tool, args, resultSummary: JSON.stringify(result).slice(0, 500), status: "ok", durationMs: Date.now() - startedAt });
    return textResult(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado.";
    void logMcpCall(ctx.admin, { ownerId: ctx.ownerId, tokenId, tool, args, resultSummary: message, status: "error", durationMs: Date.now() - startedAt });
    return errorResult(message);
  }
}

/**
 * Registra as 14 ferramentas do enunciado (6.9), cada uma só se o token tem
 * o escopo dela — um cliente MCP só *vê* as ferramentas que pode chamar.
 */
function buildServer(ctx: McpContext, scopes: string[], tokenId: string): McpServer {
  const server = new McpServer({ name: "hub", version: "1.0.0" });
  const has = (scope: McpScope) => scopes.includes(scope);

  if (has("mcp:read")) {
    server.tool("search", "Busca itens da base por texto, com trecho, id e url.", searchInput, (input) =>
      wrapCall(ctx, tokenId, "search", input, () => mcpSearch(ctx, input)),
    );
    server.tool(
      "get_item",
      "Detalhe de um item: título, tipo, espaço, propriedades legíveis, conteúdo em Markdown, backlinks, anexos e resumo de transcrição.",
      getItemInput,
      (input) => wrapCall(ctx, tokenId, "get_item", input, () => mcpGetItem(ctx, input)),
    );
    server.tool("list_items", "Lista itens de um tipo, com filtro de texto opcional no título.", listItemsInput, (input) =>
      wrapCall(ctx, tokenId, "list_items", input, () => mcpListItems(ctx, input)),
    );
    server.tool("list_spaces_and_types", "Lista espaços, tipos e campos existentes na organização.", () =>
      wrapCall(ctx, tokenId, "list_spaces_and_types", {}, () => mcpListSpacesAndTypes(ctx)),
    );
    server.tool(
      "ask_knowledge_base",
      "Recupera trechos relevantes da base pra uma pergunta, numerados — não gera uma resposta em linguagem natural (evita custo duplo de IA).",
      askKnowledgeBaseInput,
      (input) => wrapCall(ctx, tokenId, "ask_knowledge_base", input, () => mcpAskKnowledgeBase(ctx, input)),
    );
    server.tool("list_events", "Eventos da agenda (reuniões, prazos de itens, lembretes) num período (datas AAAA-MM-DD).", listEventsInput, (input) =>
      wrapCall(ctx, tokenId, "list_events", input, () => mcpListEvents(ctx, input)),
    );
    server.tool("list_tasks", "Tarefas, com filtro opcional por prazo, status e projeto.", listTasksInput, (input) =>
      wrapCall(ctx, tokenId, "list_tasks", input, () => mcpListTasks(ctx, input)),
    );
    server.tool("get_contact", "Dados básicos de um contato e itens ligados recentes — nunca inclui telefone/e-mail.", getContactInput, (input) =>
      wrapCall(ctx, tokenId, "get_contact", input, () => mcpGetContact(ctx, input)),
    );
  }

  if (has("finance:read")) {
    server.tool("finance_summary", "Resumo financeiro (entradas, saídas, resultado) num período (datas AAAA-MM-DD).", financeSummaryInput, (input) =>
      wrapCall(ctx, tokenId, "finance_summary", input, () => mcpFinanceSummary(ctx, input)),
    );
    server.tool("list_transactions", "Lançamentos financeiros de um período (datas AAAA-MM-DD).", listTransactionsInput, (input) =>
      wrapCall(ctx, tokenId, "list_transactions", input, () => mcpListTransactions(ctx, input)),
    );
  }

  if (has("mcp:write")) {
    server.tool("create_item", "Cria um item novo — vai para o inbox se nenhum espaço for informado.", createItemInput, (input) =>
      wrapCall(ctx, tokenId, "create_item", input, () => mcpCreateItem(ctx, input)),
    );
    server.tool("append_to_item", "Acrescenta Markdown ao final do conteúdo de um item já existente.", appendToItemInput, (input) =>
      wrapCall(ctx, tokenId, "append_to_item", input, () => mcpAppendToItem(ctx, input)),
    );
    server.tool("update_properties", "Atualiza propriedades de um item, validadas contra os campos do tipo dele.", updatePropertiesInput, (input) =>
      wrapCall(ctx, tokenId, "update_properties", input, () => mcpUpdateProperties(ctx, input)),
    );
    server.tool("create_reminder_for_me", "Cria um lembrete único pro próprio dono (nunca para terceiros).", createReminderForMeInput, (input) =>
      wrapCall(ctx, tokenId, "create_reminder_for_me", input, () => mcpCreateReminderForMe(ctx, input)),
    );
  }

  return server;
}

function jsonRpcError(message: string, status: number): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status });
}

/**
 * `/api/mcp` (6.9) — Streamable HTTP sem estado: uma instância nova de
 * `McpServer`/transporte por requisição (nada de sessão em memória entre
 * chamadas), seguindo o exemplo "stateless" do próprio SDK. `Authorization:
 * Bearer <token>` com pelo menos um dos escopos `mcp:read`/`mcp:write`/
 * `finance:read` — cada ferramenta acima só se registra se o token tem o
 * escopo específico dela.
 */
async function handleMcpRequest(request: Request): Promise<Response> {
  const verified = await verifyApiTokenAnyScope(request, [...MCP_SCOPES]);
  if (!verified) {
    return jsonRpcError("Token inválido, revogado, expirado ou sem escopo mcp:read, mcp:write ou finance:read.", 401);
  }
  if (isMcpRateLimited(verified.tokenId)) {
    return jsonRpcError("Limite de requisições excedido (120/min). Tente de novo em instantes.", 429);
  }

  const admin = createAdminClient();
  const timezone = await getUserTimezone(admin, verified.ownerId);
  const ctx: McpContext = { admin, ownerId: verified.ownerId, timezone };

  const server = buildServer(ctx, verified.scopes, verified.tokenId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
