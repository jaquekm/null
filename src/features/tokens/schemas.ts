import { z } from "zod";

/** Escopos já suportados por alguma rota (hoje só `/api/capture`, 1.10). */
export const AVAILABLE_SCOPES = ["capture"] as const;
export type ApiScope = (typeof AVAILABLE_SCOPES)[number];

export const SCOPE_LABELS: Record<ApiScope, string> = {
  capture: "Captura rápida (POST /api/capture)",
};

/**
 * Escopos previstos no plano (`docs/fase-01-nucleo.md`, 1.11) para módulos
 * que ainda não existem — mostrados desabilitados no formulário até que o
 * módulo correspondente seja construído.
 */
export const UPCOMING_SCOPES = ["mcp:read", "mcp:write", "finance:read"] as const;

export const TOKEN_VALIDITY_OPTIONS = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "365 dias" },
  { value: "never", label: "Sem validade" },
] as const;
export type TokenValidity = (typeof TOKEN_VALIDITY_OPTIONS)[number]["value"];

export const createTokenSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao token.").max(100, "Nome muito longo."),
  scopes: z.array(z.enum(AVAILABLE_SCOPES)).min(1, "Escolha ao menos um escopo."),
  validity: z.enum(["30", "90", "365", "never"]),
});
