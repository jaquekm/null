import { describe, expect, it } from "vitest";
import { syncContactMentions } from "./sync-contact-mentions";

function fakeSupabase(existingContactIds: string[]) {
  const inserted: Record<string, unknown>[] = [];
  const deletedIds: string[][] = [];

  const client = {
    from: (table: string) => {
      if (table !== "item_contacts") throw new Error(`tabela inesperada: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({ data: existingContactIds.map((contact_id) => ({ contact_id })), error: null }),
          }),
        }),
        insert: (values: Record<string, unknown>[]) => {
          inserted.push(...values);
          return Promise.resolve({ error: null });
        },
        delete: () => ({
          eq: () => ({
            eq: () => ({
              in: (_col: string, ids: string[]) => {
                deletedIds.push(ids);
                return Promise.resolve({ error: null });
              },
            }),
          }),
        }),
      };
    },
  };
  return { client: client as never, inserted, deletedIds };
}

function docWithMentions(ids: string[]) {
  return {
    type: "doc",
    content: ids.map((id) => ({ type: "contactMention", attrs: { id } })),
  };
}

describe("syncContactMentions", () => {
  it("insere item_contacts pras novas menções, com role='mention'", async () => {
    const { client, inserted } = fakeSupabase([]);
    await syncContactMentions(client, "owner-1", "item-1", docWithMentions(["c1", "c2"]));

    expect(inserted).toEqual([
      { owner_id: "owner-1", item_id: "item-1", contact_id: "c1", role: "mention" },
      { owner_id: "owner-1", item_id: "item-1", contact_id: "c2", role: "mention" },
    ]);
  });

  it("remove item_contacts das menções que saíram do conteúdo", async () => {
    const { client, deletedIds } = fakeSupabase(["c1", "c2"]);
    await syncContactMentions(client, "owner-1", "item-1", docWithMentions(["c1"]));

    expect(deletedIds).toEqual([["c2"]]);
  });

  it("não faz nada quando as menções não mudaram", async () => {
    const { client, inserted, deletedIds } = fakeSupabase(["c1"]);
    await syncContactMentions(client, "owner-1", "item-1", docWithMentions(["c1"]));

    expect(inserted).toEqual([]);
    expect(deletedIds).toEqual([]);
  });

  it("conteúdo nulo remove todas as menções existentes", async () => {
    const { client, deletedIds } = fakeSupabase(["c1", "c2"]);
    await syncContactMentions(client, "owner-1", "item-1", null);

    expect(deletedIds).toEqual([["c1", "c2"]]);
  });
});
