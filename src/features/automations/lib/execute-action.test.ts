import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { FakeSupabase } from "@/lib/testing/fake-supabase";

const enqueueJob = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob }));

const notifyOwner = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner }));

vi.mock("@/lib/env", () => ({
  serverEnv: { AUTOMATION_WEBHOOK_URL: "https://n8n.example.com/hook", N8N_WEBHOOK_SECRET: "s3gredo" },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { executeAction } = await import("./execute-action");
type ExecuteActionContext = Parameters<typeof executeAction>[1];

const OWNER_ID = "owner-1";

function client(fake: FakeSupabase) {
  return fake as unknown as SupabaseClient<Database>;
}

function baseCtx(fake: FakeSupabase, overrides: Partial<ExecuteActionContext> = {}): ExecuteActionContext {
  return {
    supabase: client(fake),
    ownerId: OWNER_ID,
    automationId: "automation-1",
    item: {
      id: "item-1",
      typeId: "type-1",
      spaceId: "space-1",
      title: "Oportunidade X",
      status: "active",
      properties: { stage: "novo", valor: 15000, contato: ["contact-1"] },
    },
    chainId: "chain-1",
    depth: 1,
    ...overrides,
  };
}

beforeEach(() => {
  enqueueJob.mockClear();
  notifyOwner.mockClear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
});

describe("executeAction", () => {
  it("set_property atualiza a propriedade e reemite evento com o mesmo chainId", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, properties: { stage: "novo" } }]);

    const result = await executeAction({ type: "set_property", field: "stage", value: "won" }, baseCtx(fake));
    expect(result.ok).toBe(true);
    expect(fake.rowsOf("items")[0]!.properties).toEqual({ stage: "won", valor: 15000, contato: ["contact-1"] });
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    expect(enqueueJob.mock.calls[0]![0].payload).toMatchObject({ chainId: "chain-1", depth: 1 });
  });

  it("set_property resolve {{today+7d}}", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, properties: {} }]);

    await executeAction({ type: "set_property", field: "prazo", value: "{{today+7d}}" }, baseCtx(fake));
    const value = (fake.rowsOf("items")[0]!.properties as Record<string, unknown>).prazo as string;
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sem item: falha com erro claro", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction({ type: "set_property", field: "x", value: 1 }, baseCtx(fake, { item: null }));
    expect(result.ok).toBe(false);
  });

  it("add_tag cria a tag e anexa ao item", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction({ type: "add_tag", tag: "Urgente" }, baseCtx(fake));
    expect(result.ok).toBe(true);
    expect(fake.rowsOf("tags")).toHaveLength(1);
    expect(fake.rowsOf("tags")[0]!.name).toBe("urgente");
    expect(fake.rowsOf("item_tags")).toHaveLength(1);
    expect(enqueueJob).toHaveBeenCalledTimes(1);
  });

  it("remove_tag remove o vínculo quando a tag existe", async () => {
    const fake = new FakeSupabase();
    fake.seed("tags", [{ id: "tag-1", owner_id: OWNER_ID, name: "urgente" }]);
    fake.seed("item_tags", [{ item_id: "item-1", tag_id: "tag-1", owner_id: OWNER_ID }]);

    const result = await executeAction({ type: "remove_tag", tag: "urgente" }, baseCtx(fake));
    expect(result.ok).toBe(true);
    expect(fake.rowsOf("item_tags")).toHaveLength(0);
  });

  it("move_to_space atualiza space_id", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, space_id: "space-1" }]);
    await executeAction({ type: "move_to_space", spaceId: "space-2" }, baseCtx(fake));
    expect(fake.rowsOf("items")[0]!.space_id).toBe("space-2");
  });

  it("create_item cria item com source=automation e emite item_created", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction(
      { type: "create_item", typeId: "type-2", title: "Follow-up: {{title}}", properties: {}, linkToTrigger: true, parent: false },
      baseCtx(fake),
    );
    expect(result.ok).toBe(true);
    const items = fake.rowsOf("items");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Follow-up: Oportunidade X", source: "automation", type_id: "type-2" });
    expect(fake.rowsOf("links")).toHaveLength(1);
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    expect(enqueueJob.mock.calls[0]![0].payload.event).toEqual({ type: "item_created" });
  });

  it("create_checklist acrescenta taskList ao conteúdo existente", async () => {
    const fake = new FakeSupabase();
    fake.seed("items", [{ id: "item-1", owner_id: OWNER_ID, content: { type: "doc", content: [] } }]);
    const result = await executeAction({ type: "create_checklist", items: ["Ligar", "Enviar proposta"] }, baseCtx(fake));
    expect(result.ok).toBe(true);
    const content = fake.rowsOf("items")[0]!.content as { content: { type: string }[] };
    expect(content.content).toHaveLength(1);
    expect(content.content[0]!.type).toBe("taskList");
  });

  it("create_reminder (recipient 'me') cria lembrete com send_at deslocado", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction({ type: "create_reminder", recipient: "me", offsetMinutes: 60, message: "Oi" }, baseCtx(fake));
    expect(result.ok).toBe(true);
    expect(fake.rowsOf("reminders")).toHaveLength(1);
    expect(fake.rowsOf("reminders")[0]).toMatchObject({ recipient_type: "me", source_type: "automation" });
  });

  it("create_reminder (recipient 'contact_field') usa os contatos do campo", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction(
      { type: "create_reminder", recipient: "contact_field", field: "contato", offsetMinutes: 0, message: "Oi" },
      baseCtx(fake),
    );
    expect(result.ok).toBe(true);
    expect(fake.rowsOf("reminders")[0]!.contact_ids).toEqual(["contact-1"]);
  });

  it("create_reminder (recipient 'contact_field') sem contato: falha sem criar nada", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction(
      { type: "create_reminder", recipient: "contact_field", field: "campo_vazio", offsetMinutes: 0, message: "Oi" },
      baseCtx(fake),
    );
    expect(result.ok).toBe(false);
    expect(fake.rowsOf("reminders")).toHaveLength(0);
  });

  it("notify_me chama notifyOwner com título/corpo resolvidos", async () => {
    const fake = new FakeSupabase();
    await executeAction({ type: "notify_me", title: "Oi {{title}}", body: "corpo" }, baseCtx(fake));
    expect(notifyOwner).toHaveBeenCalledWith(OWNER_ID, { title: "Oi Oportunidade X", text: "corpo" });
  });

  it("create_bill usa o campo de valor e cria conta a receber vinculada ao item", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction(
      { type: "create_bill", direction: "receivable", amountField: "valor", dueInDays: 5, contactField: "contato", description: "Fatura {{title}}" },
      baseCtx(fake),
    );
    expect(result.ok).toBe(true);
    expect(fake.rowsOf("fin_bills")[0]).toMatchObject({
      direction: "receivable",
      amount_cents: 15000,
      contact_id: "contact-1",
      item_id: "item-1",
      description: "Fatura Oportunidade X",
    });
  });

  it("create_bill com campo de valor inválido: falha sem criar conta", async () => {
    const fake = new FakeSupabase();
    const ctx = baseCtx(fake, { item: { ...baseCtx(fake).item!, properties: { valor: "não é número" } } });
    const result = await executeAction(
      { type: "create_bill", direction: "payable", amountField: "valor", dueInDays: 5, description: "x" },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(fake.rowsOf("fin_bills")).toHaveLength(0);
  });

  it("create_review_cards cria card pros itens ligados (nas duas direções do link) e ignora duplicado", async () => {
    const fake = new FakeSupabase({ review_cards: ["item_id"] });
    fake.seed("links", [
      { id: "l1", source_id: "item-1", target_id: "flash-1" },
      { id: "l2", source_id: "flash-2", target_id: "item-1" },
    ]);
    fake.seed("review_cards", [{ id: "rc-existing", owner_id: OWNER_ID, item_id: "flash-1" }]);

    const result = await executeAction({ type: "create_review_cards" }, baseCtx(fake));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.detail).toMatchObject({ created: 1, candidates: 2 });
    expect(fake.rowsOf("review_cards")).toHaveLength(2);
  });

  it("call_webhook assina e envia só pra URL permitida", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction({ type: "call_webhook", url: "https://n8n.example.com/hook" }, baseCtx(fake));
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://n8n.example.com/hook");
    expect((init as RequestInit).headers).toMatchObject({ "X-Hub-Signature": expect.any(String) });
  });

  it("call_webhook rejeita URL fora da lista permitida", async () => {
    const fake = new FakeSupabase();
    const result = await executeAction({ type: "call_webhook", url: "https://malicioso.example.com" }, baseCtx(fake));
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
