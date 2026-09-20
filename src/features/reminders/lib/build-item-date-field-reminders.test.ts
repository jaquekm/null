import { describe, expect, it } from "vitest";
import { buildItemDateFieldReminders, type ItemDateFieldRule, type ItemForDateFieldRule } from "./build-item-date-field-reminders";

const timezone = "America/Sao_Paulo";
const appUrl = "https://hub.example";
const now = new Date("2026-01-01T12:00:00.000Z"); // 09:00 em São Paulo

function fakeItem(overrides: Partial<ItemForDateFieldRule> = {}): ItemForDateFieldRule {
  return { id: "item-1", title: "Entregar relatório", type_id: "type-tarefa", properties: { prazo: "2026-01-10" }, ...overrides };
}

function fakeRule(overrides: Partial<ItemDateFieldRule> = {}): ItemDateFieldRule {
  return {
    id: "rule-1",
    channel: "auto",
    messageTemplate: "Lembrete: {{titulo}} vence {{data}}.",
    config: { typeId: "type-tarefa", fieldKey: "prazo", fieldType: "date", daysBefore: 2 },
    ...overrides,
  };
}

describe("buildItemDateFieldReminders", () => {
  it("gera o lembrete pro dono, N dias antes do prazo às 9h local", () => {
    const result = buildItemDateFieldReminders([fakeItem()], fakeRule(), timezone, now, appUrl);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceType: "item_date_field",
      sourceId: "item-1",
      recipientType: "me",
      variables: { link: "https://hub.example/itens/item-1", data: "10/01/2026" },
    });
    // prazo 10/01 09:00 local - 2 dias = 08/01 09:00 local = 12:00Z
    expect(result[0]!.sendAt).toBe("2026-01-08T12:00:00.000Z");
  });

  it("item de outro tipo: ignora", () => {
    const result = buildItemDateFieldReminders([fakeItem({ type_id: "type-outro" })], fakeRule(), timezone, now, appUrl);
    expect(result).toEqual([]);
  });

  it("campo vazio/ausente: ignora", () => {
    const result = buildItemDateFieldReminders([fakeItem({ properties: {} })], fakeRule(), timezone, now, appUrl);
    expect(result).toEqual([]);
  });

  it("campo datetime (com hora)", () => {
    const rule = fakeRule({ config: { typeId: "type-tarefa", fieldKey: "prazo", fieldType: "datetime", daysBefore: 1 } });
    const item = fakeItem({ properties: { prazo: "2026-01-10T18:00:00.000Z" } });
    const result = buildItemDateFieldReminders([item], rule, timezone, now, appUrl);
    expect(result[0]!.sendAt).toBe("2026-01-09T18:00:00.000Z");
  });

  it("send_at já passado (prazo muito próximo): não gera", () => {
    const item = fakeItem({ properties: { prazo: "2026-01-02" } }); // amanhã, daysBefore=2 fica no passado
    const result = buildItemDateFieldReminders([item], fakeRule(), timezone, now, appUrl);
    expect(result).toEqual([]);
  });

  it("fora da janela de 30 dias: não gera", () => {
    const item = fakeItem({ properties: { prazo: "2026-03-01" } });
    const result = buildItemDateFieldReminders([item], fakeRule(), timezone, now, appUrl);
    expect(result).toEqual([]);
  });

  it("regra sem typeId/fieldKey/fieldType configurado: não gera nada", () => {
    const result = buildItemDateFieldReminders([fakeItem()], fakeRule({ config: {} }), timezone, now, appUrl);
    expect(result).toEqual([]);
  });
});
