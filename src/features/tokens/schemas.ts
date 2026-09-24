import { z } from "zod";

/** Escopos suportados por alguma rota (1.10: `/api/capture`; 6.9: `/api/mcp`). */
export const AVAILABLE_SCOPES = ["capture", "mcp:read", "mcp:write", "finance:read"] as const;
export type ApiScope = (typeof AVAILABLE_SCOPES)[number];

export const SCOPE_LABELS: Record<ApiScope, string> = {
  capture: "Captura rápida (POST /api/capture)",
  "mcp:read": "MCP — leitura (buscar, ler itens, agenda, contatos)",
  "mcp:write": "MCP — escrita (criar/editar itens, criar lembretes)",
  "finance:read": "MCP — leitura financeira (resumo e lançamentos)",
};

/** Escopos MCP (6.9) — validade obrigatória de no máximo 90 dias (nunca "sem validade"), ver `createTokenSchema`. */
export const MCP_SCOPES: ApiScope[] = ["mcp:read", "mcp:write", "finance:read"];

/**
 * Escopos previstos no plano (`docs/fase-01-nucleo.md`, 1.11) para módulos
 * que ainda não existem — mostrados desabilitados no formulário até que o
 * módulo correspondente seja construído.
 */
export const UPCOMING_SCOPES: readonly string[] = [];

export const TOKEN_VALIDITY_OPTIONS = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "365 dias" },
  { value: "never", label: "Sem validade" },
] as const;
export type TokenValidity = (typeof TOKEN_VALIDITY_OPTIONS)[number]["value"];

export const createTokenSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao token.").max(100, "Nome muito longo."),
    scopes: z.array(z.enum(AVAILABLE_SCOPES)).min(1, "Escolha ao menos um escopo."),
    validity: z.enum(["30", "90", "365", "never"]),
  })
  .refine((data) => !data.scopes.some((scope) => MCP_SCOPES.includes(scope)) || (data.validity !== "never" && data.validity !== "365"), {
    message: "Tokens com escopo de MCP exigem validade de 30 ou 90 dias.",
    path: ["validity"],
  });
