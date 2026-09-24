import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./scrub-sentry-event";

describe("scrubSentryEvent", () => {
  it("remove cookies e Authorization do request", () => {
    const event = { request: { url: "/api/x", cookies: { session: "abc" }, headers: { Authorization: "Bearer x", "User-Agent": "curl" } } };
    const result = scrubSentryEvent(event);
    expect(result.request).not.toHaveProperty("cookies");
    expect((result.request as { headers: Record<string, unknown> }).headers).not.toHaveProperty("Authorization");
    expect((result.request as { headers: Record<string, unknown> }).headers["User-Agent"]).toBe("curl");
    expect((result.request as { url: string }).url).toBe("/api/x");
  });

  it("remove conteúdo de nota, dado de contato e valor financeiro no corpo da requisição", () => {
    const event = {
      request: {
        data: {
          title: "Segredo",
          content: { type: "doc" },
          properties: { prioridade: "alta" },
          email: "dono@example.com",
          phoneE164: "+5511999998888",
          amountCents: 12345,
        },
      },
    };
    const result = scrubSentryEvent(event);
    const data = (result.request as { data: Record<string, unknown> }).data;
    expect(data.title).toBe("[removido]");
    expect(data.content).toBe("[removido]");
    expect(data.properties).toBe("[removido]");
    expect(data.email).toBe("[removido]");
    expect(data.phoneE164).toBe("[removido]");
    expect(data.amountCents).toBe("[removido]");
  });

  it("preserva campos não sensíveis (id, status, timestamp)", () => {
    const event = { request: { data: { id: "item-1", status: "active", createdAt: "2026-01-01" } } };
    const result = scrubSentryEvent(event);
    expect((result.request as { data: Record<string, unknown> }).data).toEqual({ id: "item-1", status: "active", createdAt: "2026-01-01" });
  });

  it("limpa extra, contexts e dados de breadcrumb também", () => {
    const event = {
      extra: { notes: "algo sensível" },
      contexts: { item: { title: "X" } },
      breadcrumbs: [{ message: "clique", data: { description: "sensível" } }],
    };
    const result = scrubSentryEvent(event);
    expect((result.extra as Record<string, unknown>).notes).toBe("[removido]");
    expect(((result.contexts as Record<string, unknown>).item as Record<string, unknown>).title).toBe("[removido]");
    expect((result.breadcrumbs as { data: Record<string, unknown> }[])[0]!.data.description).toBe("[removido]");
  });

  it("nunca manda event.user (app de um usuário só)", () => {
    const event = { user: { id: "owner-1", email: "dono@example.com" } };
    const result = scrubSentryEvent(event);
    expect(result).not.toHaveProperty("user");
  });

  it("evento sem request/extra/contexts: não quebra", () => {
    expect(scrubSentryEvent({ message: "erro simples" })).toEqual({ message: "erro simples" });
  });
});
