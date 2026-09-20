import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findShareLinkByTokenHash, getPublicItemResource } from "./queries";

/**
 * Builder fake encadeável (`select`/`eq`/`is`/`order`/`maybeSingle`) que
 * resolve pro `result` dado em qualquer ponto da cadeia — o bastante pro
 * que essas queries fazem.
 */
function chainable(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  (builder as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) => resolve(result);
  return builder;
}

function fakeClient(result: unknown) {
  return { from: vi.fn(() => chainable(result)) } as unknown as SupabaseClient;
}

describe("getPublicItemResource (3.12: página pública não expõe owner_id nem outros campos proibidos)", () => {
  it("nunca devolve owner_id ou outros campos, mesmo se a linha do banco trouxer mais coisa que o esperado", async () => {
    const admin = fakeClient({
      data: {
        title: "Item público",
        content: { type: "doc", content: [] },
        properties: { status: "ok" },
        object_types: { fields: [] },
        owner_id: "leaked-owner-id-should-never-appear",
        tags: ["segredo"],
        other_item_title: "Título de outro item que não devia vazar",
      },
    });

    const result = await getPublicItemResource(admin, "owner-1", "item-1");

    expect(result).not.toBeNull();
    expect(Object.keys(result!).sort()).toEqual(["content", "fields", "properties", "title"].sort());
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("leaked-owner-id-should-never-appear");
    expect(serialized).not.toContain("segredo");
    expect(serialized).not.toContain("Título de outro item que não devia vazar");
  });

  it("item inexistente: null", async () => {
    const admin = fakeClient({ data: null });
    expect(await getPublicItemResource(admin, "owner-1", "item-1")).toBeNull();
  });
});

describe("findShareLinkByTokenHash (3.12: token inválido/revogado/expirado dão a mesma resposta)", () => {
  it("token que não existe: null (mesma resposta que revogado/expirado, checada em is-share-link-active.test.ts)", async () => {
    const admin = fakeClient({ data: null });
    expect(await findShareLinkByTokenHash(admin, "hash-inexistente")).toBeNull();
  });

  it("token existente: nunca inclui token_hash bruto no retorno", async () => {
    const admin = fakeClient({
      data: {
        id: "link-1",
        owner_id: "owner-1",
        resource_type: "item",
        resource_id: "item-1",
        permission: "view",
        include_attachments: false,
        password_hash: null,
        expires_at: null,
        revoked_at: null,
      },
    });
    const result = await findShareLinkByTokenHash(admin, "hash-1");
    expect(result).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("token_hash");
  });
});
