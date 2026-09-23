import { beforeEach, describe, expect, it, vi } from "vitest";

const callClaudeMock = vi.fn();
vi.mock("@/lib/ai/claude", () => ({ callClaude: callClaudeMock }));

const { reformulateQuery } = await import("./reformulate-query");

describe("reformulateQuery", () => {
  beforeEach(() => {
    callClaudeMock.mockReset();
  });

  it("sem histórico: devolve a pergunta original sem chamar o Claude", async () => {
    const result = await reformulateQuery("owner-1", "e o mês passado?", []);

    expect(result).toBe("e o mês passado?");
    expect(callClaudeMock).not.toHaveBeenCalled();
  });

  it("com histórico: devolve a consulta reescrita pelo Claude", async () => {
    callClaudeMock.mockResolvedValue({ text: "gastos com delivery em agosto de 2026", usage: { input_tokens: 1, output_tokens: 1 } });

    const result = await reformulateQuery("owner-1", "e em agosto?", [
      { role: "user", content: "quanto gastei com delivery em julho?" },
      { role: "assistant", content: "Você gastou R$ 320 com delivery em julho." },
    ]);

    expect(result).toBe("gastos com delivery em agosto de 2026");
    expect(callClaudeMock).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "owner-1", feature: "ask_reformulate" }),
    );
  });

  it("resposta vazia do Claude: cai de volta pra pergunta original", async () => {
    callClaudeMock.mockResolvedValue({ text: "   ", usage: { input_tokens: 1, output_tokens: 1 } });

    const result = await reformulateQuery("owner-1", "e esse mês?", [{ role: "user", content: "oi" }]);

    expect(result).toBe("e esse mês?");
  });

  it("erro na chamada (IA desligada, orçamento, rede): cai de volta pra pergunta original", async () => {
    callClaudeMock.mockRejectedValue(new Error("orçamento estourado"));

    const result = await reformulateQuery("owner-1", "e esse mês?", [{ role: "user", content: "oi" }]);

    expect(result).toBe("e esse mês?");
  });
});
