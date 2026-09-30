import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const enqueueJob = vi.fn();
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob }));

const setEventAlert = vi.fn();
vi.mock("@/features/reminders/actions", () => ({ setEventAlert }));

const eventAlert = { current: { ruleId: null as string | null, minutesBefore: null as number | null, channel: "push" as const } };
vi.mock("@/features/reminders/queries", () => ({
  getEventAlert: () => Promise.resolve(eventAlert.current),
  getUserTimezone: () => Promise.resolve("America/Sao_Paulo"),
}));

interface Op {
  table: string;
  kind: "select" | "insert" | "update";
  values?: Record<string, unknown>;
  filters: [string, unknown][];
}

const db = {
  rules: [] as Record<string, unknown>[],
  automations: [] as Record<string, unknown>[],
  preferences: {} as Record<string, unknown>,
  ops: [] as Op[],
};

function builder(table: string, kind: Op["kind"], values?: Record<string, unknown>) {
  const op: Op = { table, kind, values, filters: [] };
  db.ops.push(op);
  const result = () => {
    if (kind !== "select") return { data: null, error: null };
    if (table === "reminder_rules") return { data: db.rules, error: null };
    if (table === "automations") return { data: db.automations.filter((a) => op.filters.every(([col, val]) => col !== "pack_key" || a.pack_key === val)), error: null };
    return { data: [], error: null };
  };
  const chain: Record<string, unknown> = {
    eq: (col: string, val: unknown) => {
      op.filters.push([col, val]);
      return chain;
    },
    like: () => chain,
    maybeSingle: () => Promise.resolve({ data: table === "user_settings" ? { preferences: db.preferences } : null, error: null }),
    then: (resolve: (value: unknown) => void) => resolve(result()),
  };
  return chain;
}

const supabase = {
  from: (table: string) => ({
    select: () => builder(table, "select"),
    insert: (values: Record<string, unknown>) => builder(table, "insert", values),
    update: (values: Record<string, unknown>) => builder(table, "update", values),
  }),
};

vi.mock("@/lib/auth", () => ({ requireOwner: () => Promise.resolve({ supabase, user: { id: "owner-1" } }) }));

const { setRecipeActive } = await import("./recipe-actions");

const writes = (table: string, kind: Op["kind"]) => db.ops.filter((op) => op.table === table && op.kind === kind);

beforeEach(() => {
  db.rules = [];
  db.automations = [];
  db.preferences = {};
  db.ops = [];
  eventAlert.current = { ruleId: null, minutesBefore: null, channel: "push" };
  enqueueJob.mockReset();
  setEventAlert.mockReset();
  setEventAlert.mockResolvedValue({ ok: true, data: { label: "30 minutos antes" } });
});

describe("setRecipeActive — regra de lembrete", () => {
  it("liga: cria a regra marcada com a receita e pede o generate_reminders", async () => {
    const result = await setRecipeActive({ key: "conta-a-pagar", active: true, channel: "push" });
    expect(result.ok).toBe(true);
    expect(writes("reminder_rules", "insert")[0]!.values).toMatchObject({
      owner_id: "owner-1",
      kind: "bill_due",
      recipient_type: "me",
      channel: "push",
      enabled: true,
      config: { daysBefore: 1, recipe: "conta-a-pagar" },
    });
    expect(enqueueJob).toHaveBeenCalledWith(expect.objectContaining({ kind: "generate_reminders" }));
  });

  it("WhatsApp sem número cadastrado: recusa sem gravar", async () => {
    const result = await setRecipeActive({ key: "conta-a-pagar", active: true, channel: "whatsapp" });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Notificações") });
    expect(writes("reminder_rules", "insert")).toHaveLength(0);
  });

  it("religar com outro canal: reaproveita a regra e troca o canal dos lembretes já agendados", async () => {
    db.preferences = { ownerWhatsapp: "+5511988887777" };
    db.rules = [{ id: "r1", kind: "bill_due", recipient_type: "me", channel: "push", enabled: false, config: { recipe: "conta-a-pagar" }, created_at: "2026-01-01" }];
    const result = await setRecipeActive({ key: "conta-a-pagar", active: true, channel: "whatsapp" });
    expect(result.ok).toBe(true);
    expect(writes("reminder_rules", "insert")).toHaveLength(0);
    expect(writes("reminder_rules", "update")[0]!.values).toEqual({ enabled: true, channel: "whatsapp" });
    expect(writes("reminders", "update")[0]!.values).toEqual({ channel: "whatsapp" });
  });

  it("desliga: desativa a regra e cancela os lembretes agendados por ela", async () => {
    db.rules = [{ id: "r1", kind: "birthday", recipient_type: "me", channel: "push", enabled: true, config: { recipe: "aniversarios" }, created_at: "2026-01-01" }];
    const result = await setRecipeActive({ key: "aniversarios", active: false });
    expect(result.ok).toBe(true);
    expect(writes("reminder_rules", "update")[0]!.values).toEqual({ enabled: false });
    const cancel = writes("reminders", "update")[0]!;
    expect(cancel.values).toEqual({ status: "canceled" });
    expect(cancel.filters).toContainEqual(["rule_id", "r1"]);
  });

  it("canal fixo (cobrança): grava 'auto' mesmo se pedirem outro", async () => {
    await setRecipeActive({ key: "cobrar-conta-a-receber", active: true, channel: "push" });
    expect(writes("reminder_rules", "insert")[0]!.values).toMatchObject({ recipient_type: "contacts", channel: "auto" });
  });
});

describe("setRecipeActive — aviso de evento", () => {
  it("liga pelo mesmo controle da Agenda, com 30 min por padrão", async () => {
    await setRecipeActive({ key: "aviso-evento", active: true, channel: "email" });
    expect(setEventAlert).toHaveBeenCalledWith({ minutesBefore: 30, channel: "email" });
  });

  it("mantém o tempo já escolhido na Agenda; desligar manda null", async () => {
    eventAlert.current = { ruleId: "ev", minutesBefore: 60, channel: "push" };
    await setRecipeActive({ key: "aviso-evento", active: true, channel: "push" });
    expect(setEventAlert).toHaveBeenLastCalledWith({ minutesBefore: 60, channel: "push" });
    await setRecipeActive({ key: "aviso-evento", active: false });
    expect(setEventAlert).toHaveBeenLastCalledWith({ minutesBefore: null, channel: "push" });
  });
});

describe("setRecipeActive — automação", () => {
  it("liga: cria a automação com pack_key da receita", async () => {
    const result = await setRecipeActive({ key: "tag-urgente", active: true, channel: "push" });
    expect(result.ok).toBe(true);
    expect(writes("automations", "insert")[0]!.values).toMatchObject({
      owner_id: "owner-1",
      pack_key: "recipe:tag-urgente",
      enabled: true,
      trigger: { type: "tag_added", tag: "urgente" },
      actions: [{ type: "notify_me", title: "🔥 Urgente", body: "{{title}}" }],
    });
  });

  it("religar mantém o gatilho ajustado pela dona e só troca o canal", async () => {
    db.preferences = { ownerWhatsapp: "+5511988887777" };
    db.automations = [
      {
        id: "a1",
        enabled: false,
        pack_key: "recipe:revisao-semanal",
        actions: [{ type: "notify_me", title: "t", body: "b" }],
        created_at: "2026-01-01",
      },
    ];
    await setRecipeActive({ key: "revisao-semanal", active: true, channel: "whatsapp" });
    expect(writes("automations", "insert")).toHaveLength(0);
    expect(writes("automations", "update")[0]!.values).toEqual({ enabled: true, actions: [{ type: "notify_me", title: "t", body: "b", channel: "whatsapp" }] });
  });

  it("chave desconhecida: recusa", async () => {
    expect(await setRecipeActive({ key: "nao-existe" as never, active: true })).toMatchObject({ ok: false });
  });
});
