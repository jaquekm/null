import { describe, expect, it } from "vitest";
import { resolveJobTransition } from "./resolve-transition";

const NOW = new Date("2026-09-19T12:00:00.000Z");

describe("resolveJobTransition", () => {
  it("done: termina o job e guarda o resultado", () => {
    const transition = resolveJobTransition({ attempts: 1, maxAttempts: 5 }, { status: "done", result: { id: "x" } }, NOW);
    expect(transition).toEqual({
      status: "done",
      finishedAt: NOW.toISOString(),
      result: { id: "x" },
    });
  });

  it("failed: termina o job sem tentar de novo, mesmo com tentativas sobrando", () => {
    const transition = resolveJobTransition(
      { attempts: 1, maxAttempts: 5 },
      { status: "failed", error: "Orçamento mensal de IA atingido" },
      NOW,
    );
    expect(transition).toEqual({
      status: "failed",
      finishedAt: NOW.toISOString(),
      lastError: "Orçamento mensal de IA atingido",
    });
  });

  it("retry com tentativas sobrando: volta pra queued com o backoff padrão", () => {
    const transition = resolveJobTransition({ attempts: 1, maxAttempts: 5 }, { status: "retry", error: "timeout" }, NOW);
    expect(transition.status).toBe("queued");
    expect(transition.lastError).toBe("timeout");
    // attempts=1 → backoff de 2^1 = 2 minutos
    expect(transition.runAfter).toBe(new Date(NOW.getTime() + 2 * 60 * 1000).toISOString());
  });

  it("retry respeita um delaySeconds próprio, ignorando o backoff padrão", () => {
    const transition = resolveJobTransition(
      { attempts: 1, maxAttempts: 5 },
      { status: "retry", error: "aguardando webhook", delaySeconds: 1800 },
      NOW,
    );
    expect(transition.runAfter).toBe(new Date(NOW.getTime() + 1800 * 1000).toISOString());
  });

  it("retry sem tentativas sobrando vira failed", () => {
    const transition = resolveJobTransition({ attempts: 5, maxAttempts: 5 }, { status: "retry", error: "timeout" }, NOW);
    expect(transition).toEqual({
      status: "failed",
      finishedAt: NOW.toISOString(),
      lastError: "timeout",
    });
  });
});
