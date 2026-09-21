import { describe, expect, it } from "vitest";
import { buildBillDueReminders, type BillDueRule, type BillForDueRule, type ContactForBillDueRule } from "./build-bill-due-reminders";

const timezone = "America/Sao_Paulo";
const now = new Date("2026-01-01T00:00:00.000Z");

function fakeBill(overrides: Partial<BillForDueRule> = {}): BillForDueRule {
  return {
    id: "bill-1",
    description: "Aluguel",
    direction: "payable",
    amount_cents: 150000,
    due_on: "2026-01-10",
    status: "open",
    contact_id: null,
    recurring_id: null,
    ...overrides,
  };
}

function fakeContact(overrides: Partial<ContactForBillDueRule> = {}): ContactForBillDueRule {
  return { id: "contact-1", whatsapp_opt_in: true, email_opt_in: false, ...overrides };
}

function fakeRule(overrides: Partial<BillDueRule> = {}): BillDueRule {
  return { id: "rule-1", recipientType: "me", channel: "auto", messageTemplate: "{{titulo}} vence {{data}}, {{valor}}.", config: {}, ...overrides };
}

describe("buildBillDueReminders — recipientType 'me'", () => {
  it("conta a pagar aberta: dois lembretes, dias antes (padrão 3) e no dia às 9h local", () => {
    const result = buildBillDueReminders([fakeBill()], [], new Map(), fakeRule(), timezone, now);
    expect(result).toHaveLength(2);

    const before = result.find((r) => r.sourceId === "bill-1:before")!;
    expect(before).toMatchObject({ sourceType: "bill_due", recipientType: "me", contactIds: [], variables: { data: "10/01/2026", valor: "R$ 1.500,00" } });
    expect(before.sendAt).toBe("2026-01-07T12:00:00.000Z"); // 09:00 em SP = 12:00 UTC, 3 dias antes de 10/01

    const due = result.find((r) => r.sourceId === "bill-1:due")!;
    expect(due.sendAt).toBe("2026-01-10T12:00:00.000Z");
  });

  it("conta a receber: não gera pra 'me' (só a pagar)", () => {
    const result = buildBillDueReminders([fakeBill({ direction: "receivable" })], [], new Map(), fakeRule(), timezone, now);
    expect(result).toEqual([]);
  });

  it("conta paga: não gera mais", () => {
    const result = buildBillDueReminders([fakeBill({ status: "paid" })], [], new Map(), fakeRule(), timezone, now);
    expect(result).toEqual([]);
  });

  it("conta cancelada: não gera", () => {
    const result = buildBillDueReminders([fakeBill({ status: "canceled" })], [], new Map(), fakeRule(), timezone, now);
    expect(result).toEqual([]);
  });

  it("daysBefore customizado na regra", () => {
    const result = buildBillDueReminders([fakeBill()], [], new Map(), fakeRule({ config: { daysBefore: 1 } }), timezone, now);
    const before = result.find((r) => r.sourceId === "bill-1:before")!;
    expect(before.sendAt).toBe("2026-01-09T12:00:00.000Z");
  });

  it("conta de uma recorrência com remind_days_before próprio: recorrência manda, não o padrão da regra", () => {
    const bill = fakeBill({ recurring_id: "rec-1" });
    const result = buildBillDueReminders([bill], [], new Map([["rec-1", 7]]), fakeRule({ config: { daysBefore: 1 } }), timezone, now);
    const before = result.find((r) => r.sourceId === "bill-1:before")!;
    expect(before.sendAt).toBe("2026-01-03T12:00:00.000Z"); // 7 dias antes de 10/01
  });

  it("ocorrência já passada (antes de 'now'): não inclui essa, mas mantém a outra", () => {
    const bill = fakeBill({ due_on: "2026-01-02" }); // 3 dias antes cai em 2025-12-30, antes de 'now'
    const result = buildBillDueReminders([bill], [], new Map(), fakeRule(), timezone, now);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceId).toBe("bill-1:due");
  });
});

describe("buildBillDueReminders — recipientType 'contacts'", () => {
  const contactsRule = fakeRule({ recipientType: "contacts" });

  it("conta a receber com contato opt-in: dois lembretes, dias antes e no dia seguinte ao vencimento", () => {
    const bill = fakeBill({ direction: "receivable", contact_id: "contact-1" });
    const result = buildBillDueReminders([bill], [fakeContact()], new Map(), contactsRule, timezone, now);
    expect(result).toHaveLength(2);

    const before = result.find((r) => r.sourceId === "bill-1:before")!;
    expect(before).toMatchObject({ recipientType: "contacts", contactIds: ["contact-1"] });
    expect(before.sendAt).toBe("2026-01-07T12:00:00.000Z");

    const after = result.find((r) => r.sourceId === "bill-1:after")!;
    expect(after.sendAt).toBe("2026-01-11T12:00:00.000Z"); // dia seguinte ao vencimento
  });

  it("conta a pagar: não gera pra 'contacts' (só a receber)", () => {
    const bill = fakeBill({ direction: "payable", contact_id: "contact-1" });
    const result = buildBillDueReminders([bill], [fakeContact()], new Map(), contactsRule, timezone, now);
    expect(result).toEqual([]);
  });

  it("sem contato vinculado: não gera", () => {
    const bill = fakeBill({ direction: "receivable", contact_id: null });
    const result = buildBillDueReminders([bill], [fakeContact()], new Map(), contactsRule, timezone, now);
    expect(result).toEqual([]);
  });

  it("contato sem nenhum opt-in: não é elegível", () => {
    const bill = fakeBill({ direction: "receivable", contact_id: "contact-1" });
    const result = buildBillDueReminders([bill], [fakeContact({ whatsapp_opt_in: false, email_opt_in: false })], new Map(), contactsRule, timezone, now);
    expect(result).toEqual([]);
  });
});
