import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { estimateCostUsd } from "./pricing";

/** Orçamento mensal estourado (enunciado da 2.3) — não adianta tentar de novo, quem chama (um job) deve tratar como `failed`, não `retry`. */
export class AiBudgetExceededError extends Error {
  constructor() {
    super("Orçamento mensal de IA atingido.");
    this.name = "AiBudgetExceededError";
  }
}

/** Módulo de IA desligado globalmente ou no espaço do item — também não adianta tentar de novo. */
export class AiDisabledError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AiDisabledError";
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY });
  return client;
}

async function assertAiAllowed(ownerId: string, itemId: string | undefined): Promise<void> {
  const admin = createAdminClient();

  const { data: settings } = await admin.from("user_settings").select("modules").eq("owner_id", ownerId).maybeSingle();
  const modules = (settings?.modules as { ai?: boolean } | null) ?? {};
  if (!modules.ai) {
    throw new AiDisabledError("O módulo de IA está desligado nas configurações.");
  }

  if (itemId) {
    const { data: item } = await admin.from("items").select("space_id").eq("id", itemId).maybeSingle();
    if (item?.space_id) {
      const { data: space } = await admin.from("spaces").select("ai_enabled").eq("id", item.space_id).maybeSingle();
      if (space && !space.ai_enabled) {
        throw new AiDisabledError("A IA está desligada para o espaço deste item.");
      }
    }
  }
}

async function assertWithinBudget(ownerId: string): Promise<void> {
  if (!serverEnv.AI_MONTHLY_BUDGET_USD) return;

  const admin = createAdminClient();
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data, error } = await admin
    .from("usage_events")
    .select("cost_usd")
    .eq("owner_id", ownerId)
    .eq("provider", "anthropic")
    .gte("created_at", startOfMonth.toISOString());
  if (error) return; // não trava a chamada por causa de uma falha ao conferir o orçamento

  const spent = data.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
  if (spent >= serverEnv.AI_MONTHLY_BUDGET_USD) {
    throw new AiBudgetExceededError();
  }
}

async function recordUsage(input: {
  ownerId: string;
  feature: string;
  model: string;
  itemId?: string;
  usage: { input_tokens: number; output_tokens: number };
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("usage_events").insert({
    owner_id: input.ownerId,
    provider: "anthropic",
    feature: input.feature,
    model: input.model,
    units: input.usage as unknown as Json,
    cost_usd: estimateCostUsd(input.model, input.usage),
    item_id: input.itemId ?? null,
  });
}

export interface CallClaudeOptions {
  ownerId: string;
  feature: string;
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  itemId?: string;
}

export interface CallClaudeResult {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Chamada única ao Claude (2.3): confere módulo de IA/espaço e orçamento
 * mensal antes de chamar, registra o uso em `usage_events` depois. Lança
 * `AiDisabledError`/`AiBudgetExceededError` — quem chama (um handler de job)
 * deve capturar e devolver `{ status: 'failed', error: err.message }`, não
 * deixar a exceção subir (`runJob`, 2.2, trataria como `retry`, e tentar de
 * novo não resolve nenhum dos dois casos).
 */
export async function callClaude(opts: CallClaudeOptions): Promise<CallClaudeResult> {
  await assertAiAllowed(opts.ownerId, opts.itemId);
  await assertWithinBudget(opts.ownerId);

  const model = serverEnv.ANTHROPIC_MODEL ?? "claude-sonnet-5";

  const message = await getClient().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: opts.messages,
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const usage = { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens };

  await recordUsage({ ownerId: opts.ownerId, feature: opts.feature, model, itemId: opts.itemId, usage });

  return { text, usage };
}

const JSON_ONLY_INSTRUCTION =
  "\n\nResponda somente com JSON válido — sem texto antes ou depois, sem cercas de código markdown (```).";

/** Remove cercas de código markdown (```json ... ```) que o modelo às vezes adiciona mesmo quando instruído a não fazer isso. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1]!.trim() : trimmed;
}

export interface CallClaudeJsonOptions<T> extends CallClaudeOptions {
  schema: z.ZodType<T>;
}

/**
 * Como `callClaude`, mas exige uma resposta JSON validada por `schema`
 * (2.3). JSON inválido (parse ou schema) tenta **uma vez** de novo,
 * mandando o erro de volta pro modelo corrigir; falhando de novo, lança.
 */
export async function callClaudeJson<T>(opts: CallClaudeJsonOptions<T>): Promise<T> {
  const system = opts.system + JSON_ONLY_INSTRUCTION;

  const first = await callClaude({ ...opts, system });
  const firstAttempt = tryParse(first.text, opts.schema);
  if (firstAttempt.ok) return firstAttempt.data;

  const retry = await callClaude({
    ...opts,
    system,
    messages: [
      ...opts.messages,
      { role: "assistant", content: first.text },
      {
        role: "user",
        content: `A resposta anterior não é um JSON válido para o formato esperado: ${firstAttempt.error}\n\nResponda de novo, só com o JSON corrigido.`,
      },
    ],
  });
  const secondAttempt = tryParse(retry.text, opts.schema);
  if (secondAttempt.ok) return secondAttempt.data;

  throw new Error(`Resposta da IA não é um JSON válido depois de uma nova tentativa: ${secondAttempt.error}`);
}

function tryParse<T>(text: string, schema: z.ZodType<T>): { ok: true; data: T } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(stripCodeFences(text));
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "JSON inválido." };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  }
  return { ok: true, data: parsed.data };
}
