import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import { deleteContactPermanently, getContactExportData } from "./lgpd";

const OWNER_ID = "owner-1";
const CONTACT_ID = "contact-1";

function fakeWithStorage() {
  const fake = new FakeSupabase();
  const removed: string[][] = [];
  (fake as unknown as { storage: unknown }).storage = { from: () => ({ remove: (paths: string[]) => { removed.push(paths); return Promise.resolve({ error: null }); } }) };
  return { fake, removed };
}

describe("getContactExportData", () => {
  it("contato inexistente: null", async () => {
    const fake = new FakeSupabase();
    const data = await getContactExportData(fake as never, OWNER_ID, CONTACT_ID);
    expect(data).toBeNull();
  });

  it("junta contato, reuniões, lembretes (por contact_ids array), financeiro e links", async () => {
    const fake = new FakeSupabase();
    fake.seed("contacts", [{ id: CONTACT_ID, owner_id: OWNER_ID, name: "Maria" }]);
    fake.seed("item_contacts", [{ item_id: "item-1", role: "attendee", contact_id: CONTACT_ID }]);
    fake.seed("reminders", [
      { id: "rem-1", owner_id: OWNER_ID, title: "Ligar", send_at: "2026-01-01T00:00:00.000Z", status: "scheduled", contact_ids: [CONTACT_ID] },
      { id: "rem-2", owner_id: OWNER_ID, title: "Outro", send_at: "2026-01-01T00:00:00.000Z", status: "scheduled", contact_ids: ["outro-contato"] },
    ]);
    fake.seed("reminder_deliveries", [{ owner_id: OWNER_ID, contact_id: CONTACT_ID, occurrence_at: "2026-01-01T00:00:00.000Z", channel: "whatsapp", rendered_message: "Oi Maria", status: "sent" }]);
    fake.seed("fin_transactions", [{ id: "tx-1", owner_id: OWNER_ID, contact_id: CONTACT_ID, description: "Almoço", amount_cents: 5000, occurred_on: "2026-01-01" }]);
    fake.seed("fin_bills", []);
    fake.seed("fin_splits", []);
    fake.seed("fin_split_shares", [{ id: "share-1", split_id: "split-1", contact_id: CONTACT_ID, share_cents: 2500, settled_cents: 0 }]);
    fake.seed("share_links", []);

    const data = await getContactExportData(fake as never, OWNER_ID, CONTACT_ID);
    expect(data).not.toBeNull();
    expect((data!.contato as { name: string }).name).toBe("Maria");
    expect(data!.reunioes).toHaveLength(1);
    expect(data!.lembretes).toHaveLength(1);
    expect((data!.lembretes as { id: string }[])[0]!.id).toBe("rem-1");
    expect(data!.entregas_de_mensagem).toHaveLength(1);
    expect(data!.lancamentos_financeiros).toHaveLength(1);
    expect(data!.partes_de_divisao).toHaveLength(1);
  });
});

describe("deleteContactPermanently", () => {
  it("apaga entregas de mensagem, remove o avatar do Storage e apaga o contato", async () => {
    const { fake, removed } = fakeWithStorage();
    fake.seed("contacts", [{ id: CONTACT_ID, owner_id: OWNER_ID, name: "Maria", avatar_path: `${OWNER_ID}/avatars/maria.png` }]);
    fake.seed("reminder_deliveries", [
      { id: "d1", owner_id: OWNER_ID, contact_id: CONTACT_ID },
      { id: "d2", owner_id: OWNER_ID, contact_id: "outro-contato" },
    ]);
    fake.seed("reminders", []);

    await deleteContactPermanently(fake as never, OWNER_ID, CONTACT_ID);

    expect(fake.rowsOf("reminder_deliveries").map((r) => r.id)).toEqual(["d2"]);
    expect(fake.rowsOf("contacts")).toHaveLength(0);
    expect(removed).toEqual([[`${OWNER_ID}/avatars/maria.png`]]);
  });

  it("sem avatar: não chama o Storage", async () => {
    const { fake, removed } = fakeWithStorage();
    fake.seed("contacts", [{ id: CONTACT_ID, owner_id: OWNER_ID, name: "Maria", avatar_path: null }]);
    fake.seed("reminder_deliveries", []);
    fake.seed("reminders", []);

    await deleteContactPermanently(fake as never, OWNER_ID, CONTACT_ID);
    expect(removed).toEqual([]);
  });

  it("remove o id do contato de reminders.contact_ids sem apagar o lembrete inteiro", async () => {
    const { fake } = fakeWithStorage();
    fake.seed("contacts", [{ id: CONTACT_ID, owner_id: OWNER_ID, name: "Maria", avatar_path: null }]);
    fake.seed("reminder_deliveries", []);
    fake.seed("reminders", [
      { id: "rem-1", owner_id: OWNER_ID, contact_ids: [CONTACT_ID, "outro-contato"] },
      { id: "rem-2", owner_id: OWNER_ID, contact_ids: ["outro-contato"] },
    ]);

    await deleteContactPermanently(fake as never, OWNER_ID, CONTACT_ID);

    const reminders = fake.rowsOf("reminders");
    expect(reminders.find((r) => r.id === "rem-1")!.contact_ids).toEqual(["outro-contato"]);
    expect(reminders.find((r) => r.id === "rem-2")!.contact_ids).toEqual(["outro-contato"]);
  });
});
