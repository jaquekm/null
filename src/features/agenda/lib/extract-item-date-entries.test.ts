import { describe, expect, it } from "vitest";
import { extractItemDateEntries, type DateFieldDef, type ItemForDateExtraction } from "./extract-item-date-entries";

const RANGE_START = "2026-01-01T00:00:00.000Z";
const RANGE_END = "2026-02-01T00:00:00.000Z";

const dateFieldsByTypeId = new Map<string, DateFieldDef[]>([
  ["type-tarefa", [{ key: "prazo", label: "Prazo", type: "date" }]],
  [
    "type-evento-manual",
    [
      { key: "inicio", label: "Início", type: "datetime" },
      { key: "fim", label: "Fim", type: "datetime" },
    ],
  ],
]);

describe("extractItemDateEntries", () => {
  it("campo `date` (sem hora) vira bloco de dia inteiro, meia-noite UTC até o dia seguinte", () => {
    const item: ItemForDateExtraction = { id: "item-1", title: "Entregar relatório", type_id: "type-tarefa", properties: { prazo: "2026-01-15" } };

    const entries = extractItemDateEntries([item], dateFieldsByTypeId, RANGE_START, RANGE_END);

    expect(entries).toEqual([
      {
        id: "item:item-1:prazo",
        title: "Prazo: Entregar relatório",
        start: "2026-01-15T00:00:00.000Z",
        end: "2026-01-16T00:00:00.000Z",
        allDay: true,
        color: "#d97706",
        editable: false,
        kind: "item-date",
        href: "/itens/item-1",
      },
    ]);
  });

  it("campo `datetime` vira evento pontual (sem `end`)", () => {
    const item: ItemForDateExtraction = {
      id: "item-2",
      title: "Consulta",
      type_id: "type-evento-manual",
      properties: { inicio: "2026-01-10T13:00:00.000Z", fim: "2026-01-10T14:00:00.000Z" },
    };

    const entries = extractItemDateEntries([item], dateFieldsByTypeId, RANGE_START, RANGE_END);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ id: "item:item-2:inicio", start: "2026-01-10T13:00:00.000Z", end: null, allDay: false });
    expect(entries[1]).toMatchObject({ id: "item:item-2:fim", start: "2026-01-10T14:00:00.000Z", end: null, allDay: false });
  });

  it("item sem type_id: ignorado", () => {
    const item: ItemForDateExtraction = { id: "item-3", title: "Sem tipo", type_id: null, properties: { prazo: "2026-01-15" } };
    expect(extractItemDateEntries([item], dateFieldsByTypeId, RANGE_START, RANGE_END)).toEqual([]);
  });

  it("tipo sem campo de data: ignorado", () => {
    const item: ItemForDateExtraction = { id: "item-4", title: "Tipo qualquer", type_id: "type-sem-data", properties: {} };
    expect(extractItemDateEntries([item], dateFieldsByTypeId, RANGE_START, RANGE_END)).toEqual([]);
  });

  it("valor do campo ausente, vazio ou não-string: ignorado", () => {
    const items: ItemForDateExtraction[] = [
      { id: "a", title: "a", type_id: "type-tarefa", properties: {} },
      { id: "b", title: "b", type_id: "type-tarefa", properties: { prazo: "" } },
      { id: "c", title: "c", type_id: "type-tarefa", properties: { prazo: 123 } },
      { id: "d", title: "d", type_id: "type-tarefa", properties: null },
    ];
    expect(extractItemDateEntries(items, dateFieldsByTypeId, RANGE_START, RANGE_END)).toEqual([]);
  });

  it("fora do intervalo pedido: ignorado", () => {
    const before: ItemForDateExtraction = { id: "before", title: "before", type_id: "type-tarefa", properties: { prazo: "2025-12-31" } };
    const after: ItemForDateExtraction = { id: "after", title: "after", type_id: "type-tarefa", properties: { prazo: "2026-02-01" } };
    expect(extractItemDateEntries([before, after], dateFieldsByTypeId, RANGE_START, RANGE_END)).toEqual([]);
  });

  it("data inválida: ignorada, não lança", () => {
    const item: ItemForDateExtraction = { id: "invalid", title: "invalid", type_id: "type-tarefa", properties: { prazo: "não-é-uma-data" } };
    expect(() => extractItemDateEntries([item], dateFieldsByTypeId, RANGE_START, RANGE_END)).not.toThrow();
    expect(extractItemDateEntries([item], dateFieldsByTypeId, RANGE_START, RANGE_END)).toEqual([]);
  });

  it("mais de um item, cada um com seu(s) campo(s)", () => {
    const items: ItemForDateExtraction[] = [
      { id: "t1", title: "Tarefa 1", type_id: "type-tarefa", properties: { prazo: "2026-01-05" } },
      { id: "t2", title: "Tarefa 2", type_id: "type-tarefa", properties: { prazo: "2026-01-20" } },
    ];
    const entries = extractItemDateEntries(items, dateFieldsByTypeId, RANGE_START, RANGE_END);
    expect(entries.map((e) => e.id)).toEqual(["item:t1:prazo", "item:t2:prazo"]);
  });
});
