import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const cookiesGetMock = vi.fn();
const cookiesSetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookiesGetMock, set: cookiesSetMock })),
}));

vi.mock("@/lib/env", () => ({ serverEnv: { ENCRYPTION_KEY: "test-encryption-key-not-real-3211" } }));

const notifyOwnerMock = vi.fn();
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner: notifyOwnerMock }));

const getOwnerNotificationPreferencesMock = vi.fn(async () => ({ shareComments: false }));
vi.mock("@/features/settings/queries", () => ({ getOwnerNotificationPreferences: getOwnerNotificationPreferencesMock }));

/** Builder fake encadeável — resolve pro `result` dado em qualquer ponto da cadeia. */
function chainable(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "update", "insert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  (builder as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) => resolve(result);
  return builder;
}

let tableQueues: Record<string, unknown[]>;
const fromMock = vi.fn((table: string) => {
  const queue = tableQueues[table];
  if (!queue || queue.length === 0) throw new Error(`sem resposta mockada pra tabela "${table}"`);
  return chainable(queue.shift());
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: fromMock }) }));

const { toggleShareChecklistItem, submitShareComment, verifySharePassword } = await import("./actions-public");

const BASE_LINK = {
  id: "link-1",
  owner_id: "owner-1",
  resource_type: "item",
  resource_id: "item-1",
  include_attachments: false,
  password_hash: null as string | null,
  revoked_at: null as string | null,
};

function queueShareLink(overrides: Partial<typeof BASE_LINK & { permission: string; expires_at: string | null }>) {
  tableQueues.share_links = [{ data: { ...BASE_LINK, permission: "check", expires_at: null as string | null, ...overrides } }];
}

const CHECKLIST_CONTENT = {
  type: "doc",
  content: [
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Comprar leite" }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Comprar pão" }] }] },
      ],
    },
  ],
};

beforeEach(() => {
  tableQueues = {};
  fromMock.mockClear();
  revalidatePathMock.mockClear();
  cookiesGetMock.mockClear();
  cookiesSetMock.mockClear();
  notifyOwnerMock.mockClear();
  getOwnerNotificationPreferencesMock.mockClear();
});

describe("toggleShareChecklistItem — 3.12: token inválido/revogado/expirado dão a mesma resposta", () => {
  const GENERIC_INVALID = "Link inválido ou expirado.";

  it("token que não existe", async () => {
    tableQueues.share_links = [{ data: null }];
    const result = await toggleShareChecklistItem("token-qualquer", "0.0", true);
    expect(result).toEqual({ ok: false, error: GENERIC_INVALID });
  });

  it("token revogado", async () => {
    queueShareLink({ revoked_at: "2020-01-01T00:00:00.000Z" });
    const result = await toggleShareChecklistItem("token-revogado", "0.0", true);
    expect(result).toEqual({ ok: false, error: GENERIC_INVALID });
  });

  it("token expirado", async () => {
    queueShareLink({ expires_at: "2020-01-01T00:00:00.000Z" });
    const result = await toggleShareChecklistItem("token-expirado", "0.0", true);
    expect(result).toEqual({ ok: false, error: GENERIC_INVALID });
  });
});

describe("toggleShareChecklistItem — 3.12: permissão check não permite alterar outro conteúdo", () => {
  it("link com permissão 'view' não pode marcar checklist (nunca chega a tocar em items)", async () => {
    queueShareLink({ permission: "view" });
    const result = await toggleShareChecklistItem("token-view", "0.0", true);
    expect(result).toEqual({ ok: false, error: "Essa ação não é permitida por esse link." });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).not.toHaveBeenCalledWith("items");
  });

  it("caminho inválido/fora do documento: não altera nada e não chama update", async () => {
    queueShareLink({ permission: "check" });
    // só uma resposta na fila (a leitura) — se o código tentasse um update indevido, o mock estouraria por fila vazia.
    tableQueues.items = [{ data: { content: CHECKLIST_CONTENT } }];
    const result = await toggleShareChecklistItem("token-check", "0.99", true);
    expect(result).toEqual({ ok: false, error: "Não foi possível atualizar esse item." });
  });

  it("marca só o item apontado pelo caminho, preservando o resto do conteúdo intacto", async () => {
    queueShareLink({ permission: "check" });
    tableQueues.items = [{ data: { content: CHECKLIST_CONTENT } }, { error: null }];

    const result = await toggleShareChecklistItem("token-check", "0.0", true);
    expect(result).toEqual({ ok: true, data: null });

    const updateBuilder = fromMock.mock.results[2]!.value as { update: ReturnType<typeof vi.fn> };
    const updatedContent = updateBuilder.update.mock.calls[0]![0].content as typeof CHECKLIST_CONTENT;
    const items = updatedContent.content[0]!.content;
    expect(items[0]!.attrs.checked).toBe(true);
    expect(items[1]!.attrs.checked).toBe(false);
    expect(items[0]!.content).toEqual(CHECKLIST_CONTENT.content[0]!.content[0]!.content);
    expect(items[1]!.content).toEqual(CHECKLIST_CONTENT.content[0]!.content[1]!.content);
  });

  it("escopa a atualização pelo item e dono do próprio link (não deixa mexer em outro item)", async () => {
    queueShareLink({ permission: "check", resource_id: "item-1", owner_id: "owner-1" });
    tableQueues.items = [{ data: { content: CHECKLIST_CONTENT } }, { error: null }];

    await toggleShareChecklistItem("token-check", "0.0", true);

    const readBuilder = fromMock.mock.results[1]!.value as { eq: ReturnType<typeof vi.fn> };
    expect(readBuilder.eq).toHaveBeenCalledWith("id", "item-1");
    expect(readBuilder.eq).toHaveBeenCalledWith("owner_id", "owner-1");

    const updateBuilder = fromMock.mock.results[2]!.value as { eq: ReturnType<typeof vi.fn> };
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "item-1");
    expect(updateBuilder.eq).toHaveBeenCalledWith("owner_id", "owner-1");
  });
});

describe("submitShareComment — permissão errada", () => {
  it("link 'view' não permite comentar", async () => {
    queueShareLink({ permission: "view" });
    const result = await submitShareComment("token-view", { authorName: "Fulano", body: "Oi" });
    expect(result).toEqual({ ok: false, error: "Essa ação não é permitida por esse link." });
    expect(fromMock).not.toHaveBeenCalledWith("share_comments");
  });
});

describe("verifySharePassword — 3.12: mesma resposta pra token inválido/revogado/expirado", () => {
  const GENERIC_INVALID = "Link inválido ou expirado.";

  it("token que não existe", async () => {
    tableQueues.share_links = [{ data: null }];
    const result = await verifySharePassword("token-qualquer", "senha123");
    expect(result).toEqual({ ok: false, error: GENERIC_INVALID });
  });

  it("token revogado", async () => {
    queueShareLink({ revoked_at: "2020-01-01T00:00:00.000Z", password_hash: "irrelevante" });
    const result = await verifySharePassword("token-revogado", "senha123");
    expect(result).toEqual({ ok: false, error: GENERIC_INVALID });
  });

  it("token expirado", async () => {
    queueShareLink({ expires_at: "2020-01-01T00:00:00.000Z", password_hash: "irrelevante" });
    const result = await verifySharePassword("token-expirado", "senha123");
    expect(result).toEqual({ ok: false, error: GENERIC_INVALID });
  });
});
