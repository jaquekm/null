import { describe, expect, it } from "vitest";
import { createTokenSchema } from "./schemas";

const base = { name: "Token de teste" };

describe("createTokenSchema", () => {
  it("aceita escopo capture com validade 'never'", () => {
    expect(createTokenSchema.safeParse({ ...base, scopes: ["capture"], validity: "never" }).success).toBe(true);
  });

  it.each(["mcp:read", "mcp:write", "finance:read"] as const)(
    "rejeita escopo %s com validade 'never' (6.9: MCP exige validade de no máximo 90 dias)",
    (scope) => {
      const result = createTokenSchema.safeParse({ ...base, scopes: [scope], validity: "never" });
      expect(result.success).toBe(false);
    },
  );

  it("rejeita escopo mcp:write com validade '365' (também acima de 90 dias)", () => {
    const result = createTokenSchema.safeParse({ ...base, scopes: ["mcp:write"], validity: "365" });
    expect(result.success).toBe(false);
  });

  it("aceita escopo mcp:read com validade '30' ou '90'", () => {
    expect(createTokenSchema.safeParse({ ...base, scopes: ["mcp:read"], validity: "30" }).success).toBe(true);
    expect(createTokenSchema.safeParse({ ...base, scopes: ["mcp:read"], validity: "90" }).success).toBe(true);
  });

  it("rejeita se qualquer escopo da mistura for de MCP, mesmo com 'capture' junto", () => {
    const result = createTokenSchema.safeParse({ ...base, scopes: ["capture", "finance:read"], validity: "never" });
    expect(result.success).toBe(false);
  });
});
