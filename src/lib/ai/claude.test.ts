import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const messagesCreate = vi.fn();

vi.mock("@/lib/env", () => ({
  serverEnv: {
    ANTHROPIC_API_KEY: "test-key",
    ANTHROPIC_MODEL: "claude-sonnet-5",
    AI_MONTHLY_BUDGET_USD: 20,
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { create: messagesCreate };
  },
}));

function chainable(result: { data: unknown; error: unknown }) {
  const obj = {
    select: () => obj,
    eq: () => obj,
    gte: () => obj,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return obj;
}

let usageInserts: Record<string, unknown>[] = [];
let modulesAiEnabled = true;
let spentThisMonth: { cost_usd: number | null }[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "user_settings") {
        return chainable({ data: { modules: { ai: modulesAiEnabled } }, error: null });
      }
      if (table === "usage_events") {
        return {
          ...chainable({ data: spentThisMonth, error: null }),
          insert: (row: Record<string, unknown>) => {
            usageInserts.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      return chainable({ data: null, error: null });
    },
  }),
}));

const { callClaude, callClaudeJson, AiBudgetExceededError, AiDisabledError } = await import("./claude");

function fakeMessage(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

beforeEach(() => {
  messagesCreate.mockReset();
  usageInserts = [];
  modulesAiEnabled = true;
  spentThisMonth = [];
});

describe("callClaude", () => {
  it("lança AiDisabledError sem chamar a API quando o módulo de IA está desligado", async () => {
    modulesAiEnabled = false;

    await expect(
      callClaude({ ownerId: "owner-1", feature: "teste", system: "s", messages: [{ role: "user", content: "oi" }] }),
    ).rejects.toBeInstanceOf(AiDisabledError);
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("lança AiBudgetExceededError sem chamar a API quando o gasto do mês já bateu o orçamento", async () => {
    spentThisMonth = [{ cost_usd: 15 }, { cost_usd: 6 }];

    await expect(
      callClaude({ ownerId: "owner-1", feature: "teste", system: "s", messages: [{ role: "user", content: "oi" }] }),
    ).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("devolve o texto e o uso, e registra em usage_events", async () => {
    messagesCreate.mockResolvedValueOnce(fakeMessage("Olá!"));

    const result = await callClaude({
      ownerId: "owner-1",
      feature: "teste",
      system: "Você é um assistente.",
      messages: [{ role: "user", content: "Oi" }],
    });

    expect(result.text).toBe("Olá!");
    expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 20 });
    expect(usageInserts).toHaveLength(1);
    expect(usageInserts[0]).toMatchObject({ owner_id: "owner-1", provider: "anthropic", feature: "teste" });
  });
});

describe("callClaudeJson", () => {
  const schema = z.object({ nome: z.string() });

  beforeEach(() => {
    messagesCreate.mockReset();
    usageInserts = [];
  });

  it("valida e devolve o JSON de primeira quando a resposta já é válida", async () => {
    messagesCreate.mockResolvedValueOnce(fakeMessage('{"nome": "Ana"}'));

    const result = await callClaudeJson({
      ownerId: "owner-1",
      feature: "teste",
      system: "Responda com um nome.",
      messages: [{ role: "user", content: "Qual seu nome?" }],
      schema,
    });

    expect(result).toEqual({ nome: "Ana" });
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("tira cercas de código markdown antes de validar", async () => {
    messagesCreate.mockResolvedValueOnce(fakeMessage('```json\n{"nome": "Ana"}\n```'));

    const result = await callClaudeJson({
      ownerId: "owner-1",
      feature: "teste",
      system: "Responda com um nome.",
      messages: [{ role: "user", content: "Qual seu nome?" }],
      schema,
    });

    expect(result).toEqual({ nome: "Ana" });
  });

  it("JSON inválido na primeira tentativa: tenta de novo uma vez e aceita se a segunda vier certa", async () => {
    messagesCreate.mockResolvedValueOnce(fakeMessage("isso não é JSON"));
    messagesCreate.mockResolvedValueOnce(fakeMessage('{"nome": "Ana"}'));

    const result = await callClaudeJson({
      ownerId: "owner-1",
      feature: "teste",
      system: "Responda com um nome.",
      messages: [{ role: "user", content: "Qual seu nome?" }],
      schema,
    });

    expect(result).toEqual({ nome: "Ana" });
    expect(messagesCreate).toHaveBeenCalledTimes(2);
  });

  it("JSON inválido nas duas tentativas: lança erro", async () => {
    messagesCreate.mockResolvedValueOnce(fakeMessage("não é JSON"));
    messagesCreate.mockResolvedValueOnce(fakeMessage("ainda não é JSON"));

    await expect(
      callClaudeJson({
        ownerId: "owner-1",
        feature: "teste",
        system: "Responda com um nome.",
        messages: [{ role: "user", content: "Qual seu nome?" }],
        schema,
      }),
    ).rejects.toThrow(/JSON válido/);
    expect(messagesCreate).toHaveBeenCalledTimes(2);
  });

  it("JSON válido mas fora do schema também dispara a nova tentativa", async () => {
    messagesCreate.mockResolvedValueOnce(fakeMessage('{"idade": 30}'));
    messagesCreate.mockResolvedValueOnce(fakeMessage('{"nome": "Ana"}'));

    const result = await callClaudeJson({
      ownerId: "owner-1",
      feature: "teste",
      system: "Responda com um nome.",
      messages: [{ role: "user", content: "Qual seu nome?" }],
      schema,
    });

    expect(result).toEqual({ nome: "Ana" });
  });
});

describe("guards", () => {
  it("AiDisabledError e AiBudgetExceededError têm mensagens distintas e identificáveis por instanceof", () => {
    const disabled = new AiDisabledError("motivo qualquer");
    const budget = new AiBudgetExceededError();
    expect(disabled).toBeInstanceOf(Error);
    expect(budget).toBeInstanceOf(Error);
    expect(disabled.message).toBe("motivo qualquer");
    expect(budget.message).toMatch(/[Oo]rçamento/);
  });
});
