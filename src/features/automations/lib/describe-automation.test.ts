import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { describeActionPhrase, describeAutomation, describeTrigger, durationPt } from "./describe-automation";

const fields = [
  { key: "prazo", label: "Prazo", type: "date" },
  { key: "etapa", label: "Etapa", type: "select" },
  { key: "cliente", label: "Cliente", type: "contact" },
] as FieldDefinition[];

describe("describeTrigger", () => {
  it.each([
    [{ type: "item_created" }, {}, "Quando um item for criado"],
    [{ type: "item_created" }, { typeName: "Tarefa", spaceName: "Trabalho" }, "Quando um item do tipo Tarefa em Trabalho for criado"],
    [{ type: "property_changed", field: "etapa", to: "Fechado" }, { fields }, "Quando o campo “Etapa” de um item mudar para “Fechado”"],
    [{ type: "property_changed", field: "etapa" }, { fields }, "Quando o campo “Etapa” de um item mudar"],
    [{ type: "status_changed", to: "archived" }, { typeName: "Nota" }, "Quando um item do tipo Nota for arquivado"],
    [{ type: "date_reached", field: "prazo", offsetMinutes: 0 }, { fields }, "Quando chegar a data “Prazo” de um item"],
    [{ type: "date_reached", field: "prazo", offsetMinutes: -1440 }, { fields }, "Quando faltar 1 dia para a data “Prazo” de um item"],
    [{ type: "date_reached", field: "prazo", offsetMinutes: 120 }, { fields }, "Quando passar 2 horas da data “Prazo” de um item"],
    [{ type: "no_activity", days: 7 }, { typeName: "Projeto" }, "Quando um item do tipo Projeto ficar 7 dias sem mudanças"],
    [{ type: "schedule", rrule: "DTSTART:20261002T170000Z\nRRULE:FREQ=WEEKLY;BYDAY=FR", timezone: "America/Sao_Paulo" }, {}, "Toda sexta às 17:00"],
    [{ type: "schedule", rrule: "FREQ=HOURLY", timezone: "America/Sao_Paulo" }, {}, "Em um horário que se repete"],
    [{ type: "tag_added", tag: "urgente" }, {}, "Quando um item ganhar a tag “urgente”"],
  ] as const)("%j %j → %s", (trigger, ctx, text) => {
    expect(describeTrigger(trigger as never, ctx)).toBe(text);
  });
});

describe("describeActionPhrase", () => {
  it.each([
    [{ type: "set_property", field: "prazo", value: "{{today+7d}}" }, "mudar “Prazo” para daqui a 7 dias"],
    [{ type: "set_property", field: "etapa", value: "Fechado" }, "mudar “Etapa” para “Fechado”"],
    [{ type: "add_tag", tag: "nova" }, "adicionar a tag “nova”"],
    [{ type: "remove_tag", tag: "nova" }, "tirar a tag “nova”"],
    [{ type: "move_to_space", spaceId: null }, "tirar do espaço"],
    [{ type: "move_to_space", spaceId: "s1" }, "mover para Casa"],
    [{ type: "create_item", typeId: "t", title: "Follow-up", properties: {}, linkToTrigger: true, parent: false }, "criar “Follow-up” ligado a ele"],
    [{ type: "create_checklist", items: ["a", "b"] }, "adicionar uma checklist com 2 itens"],
    [{ type: "create_reminder", recipient: "me", offsetMinutes: 1440, message: "x" }, "me lembrar daqui a 1 dia"],
    [{ type: "create_reminder", recipient: "contact_field", field: "cliente", offsetMinutes: 0, message: "x" }, "lembrar o contato de “Cliente”"],
    [{ type: "notify_me", title: "t", body: "b" }, "me avisar por notificação"],
    [{ type: "notify_me", title: "t", body: "b", channel: "whatsapp" }, "me avisar no WhatsApp"],
    [{ type: "create_bill", direction: "receivable", amountField: "v", dueInDays: 5, description: "x" }, "criar uma conta a receber em 5 dias"],
  ] as const)("%j → %s", (action, text) => {
    expect(describeActionPhrase(action as never, { fields, spaces: [{ id: "s1", name: "Casa" }] })).toBe(text);
  });
});

describe("describeAutomation", () => {
  it("junta gatilho, condições e ações numa frase", () => {
    expect(
      describeAutomation(
        {
          trigger: { type: "item_created" },
          conditions: [{ field: "etapa", op: "eq", value: "x" }] as never,
          actions: [
            { type: "add_tag", tag: "nova" },
            { type: "notify_me", title: "t", body: "b", channel: "whatsapp" },
          ],
        },
        { typeName: "Tarefa", fields },
      ),
    ).toBe("Quando um item do tipo Tarefa for criado (se a condição bater), adicionar a tag “nova” e me avisar no WhatsApp.");
  });

  it("sem ações ainda: reticências", () => {
    expect(describeAutomation({ trigger: { type: "tag_added", tag: "x" }, actions: [] })).toBe("Quando um item ganhar a tag “x”, ….");
  });
});

describe("durationPt", () => {
  it.each([
    [30, "30 minutos"],
    [1, "1 minuto"],
    [60, "1 hora"],
    [-180, "3 horas"],
    [2880, "2 dias"],
  ])("%i → %s", (minutes, text) => {
    expect(durationPt(minutes)).toBe(text);
  });
});
