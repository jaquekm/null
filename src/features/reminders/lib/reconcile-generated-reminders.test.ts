import { describe, expect, it } from "vitest";
import { reconcileGeneratedReminders, type DesiredReminder, type ExistingGeneratedReminder } from "./reconcile-generated-reminders";

function desired(overrides: Partial<DesiredReminder> = {}): DesiredReminder {
  return {
    sourceType: "event",
    sourceId: "event-1",
    sendAt: "2026-02-01T12:00:00.000Z",
    title: "Reunião",
    messageTemplate: "Oi {{nome}}",
    channel: "auto",
    recipientType: "contacts",
    contactIds: ["contact-1"],
    variables: { link: "https://meet.example/x" },
    itemId: null,
    ...overrides,
  };
}

function existingRow(overrides: Partial<ExistingGeneratedReminder> = {}): ExistingGeneratedReminder {
  return { id: "rem-1", sourceType: "event", sourceId: "event-1", status: "scheduled", sendAt: "2026-02-01T12:00:00.000Z", ...overrides };
}

describe("reconcileGeneratedReminders", () => {
  it("fonte nova (sem lembrete existente): insere", () => {
    const result = reconcileGeneratedReminders([desired()], []);
    expect(result).toEqual({ toInsert: [desired()], toUpdate: [], toCancel: [] });
  });

  it("fonte já com lembrete 'scheduled': atualiza send_at/variables/contactIds, sem mexer no status", () => {
    const result = reconcileGeneratedReminders(
      [desired({ sendAt: "2026-02-02T12:00:00.000Z", contactIds: ["contact-1", "contact-2"] })],
      [existingRow({ status: "scheduled" })],
    );
    expect(result.toInsert).toEqual([]);
    expect(result.toUpdate).toEqual([
      { id: "rem-1", sendAt: "2026-02-02T12:00:00.000Z", variables: { link: "https://meet.example/x" }, contactIds: ["contact-1", "contact-2"] },
    ]);
    expect(result.toCancel).toEqual([]);
  });

  it("fonte já com lembrete 'paused': também atualiza (não força de volta pra scheduled)", () => {
    const result = reconcileGeneratedReminders([desired()], [existingRow({ status: "paused" })]);
    expect(result.toUpdate).toEqual([{ id: "rem-1", sendAt: desired().sendAt, variables: desired().variables, contactIds: desired().contactIds }]);
  });

  it("lembrete 'completed' com o mesmo send_at (mesma ocorrência): não mexe", () => {
    const result = reconcileGeneratedReminders([desired()], [existingRow({ status: "completed", sendAt: desired().sendAt })]);
    expect(result).toEqual({ toInsert: [], toUpdate: [], toCancel: [] });
  });

  it("lembrete 'completed' com send_at diferente (ocorrência nova — aniversário do ano seguinte, prazo adiado): reativa", () => {
    const result = reconcileGeneratedReminders(
      [desired({ sendAt: "2027-02-01T12:00:00.000Z" })],
      [existingRow({ status: "completed", sendAt: "2026-02-01T12:00:00.000Z" })],
    );
    expect(result.toUpdate).toEqual([
      { id: "rem-1", sendAt: "2027-02-01T12:00:00.000Z", variables: { link: "https://meet.example/x" }, contactIds: ["contact-1"], status: "scheduled" },
    ]);
  });

  it("lembrete 'canceled': nunca mexe, mesmo com send_at diferente", () => {
    const result = reconcileGeneratedReminders(
      [desired({ sendAt: "2027-02-01T12:00:00.000Z" })],
      [existingRow({ status: "canceled", sendAt: "2026-02-01T12:00:00.000Z" })],
    );
    expect(result).toEqual({ toInsert: [], toUpdate: [], toCancel: [] });
  });

  it("fonte sumiu (evento cancelado) e lembrete ainda 'scheduled': cancela", () => {
    const result = reconcileGeneratedReminders([], [existingRow({ status: "scheduled" })]);
    expect(result).toEqual({ toInsert: [], toUpdate: [], toCancel: ["rem-1"] });
  });

  it("fonte sumiu mas lembrete já 'completed': não cancela (já foi enviado, deixa como está)", () => {
    const result = reconcileGeneratedReminders([], [existingRow({ status: "completed" })]);
    expect(result.toCancel).toEqual([]);
  });

  it("fonte sumiu mas lembrete já 'canceled': idempotente, não tenta cancelar de novo", () => {
    const result = reconcileGeneratedReminders([], [existingRow({ status: "canceled" })]);
    expect(result.toCancel).toEqual([]);
  });

  it("mistura: uma fonte nova, uma atualizada, uma cancelada", () => {
    const result = reconcileGeneratedReminders(
      [desired({ sourceId: "event-1" }), desired({ sourceId: "event-2" })],
      [existingRow({ id: "rem-1", sourceId: "event-1", status: "scheduled" }), existingRow({ id: "rem-3", sourceId: "event-3", status: "scheduled" })],
    );
    expect(result.toInsert.map((r) => r.sourceId)).toEqual(["event-2"]);
    expect(result.toUpdate.map((r) => r.id)).toEqual(["rem-1"]);
    expect(result.toCancel).toEqual(["rem-3"]);
  });

  it("mesmo sourceId em source_types diferentes não colide", () => {
    const result = reconcileGeneratedReminders(
      [desired({ sourceType: "birthday", sourceId: "contact-1" }), desired({ sourceType: "birthday_contact", sourceId: "contact-1" })],
      [],
    );
    expect(result.toInsert).toHaveLength(2);
  });
});
