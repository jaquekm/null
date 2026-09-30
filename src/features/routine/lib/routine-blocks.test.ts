import { describe, expect, it } from "vitest";
import {
  blocksForDate,
  buildRoutineEntries,
  describeBlockTime,
  parseRoutineBlocks,
  removeBlock,
  routineBlockSchema,
  routineNow,
  upsertBlock,
  type RoutineBlock,
} from "./routine-blocks";

// Quarta, 30/09/2026.
const TODAY = "2026-09-30";
const acordar: RoutineBlock = { id: "a", title: "Acordar", start: "06:00", end: null, days: [] };
const academia: RoutineBlock = { id: "b", title: "Academia", start: "08:00", end: "09:00", days: ["MO", "WE", "FR"] };
const almoco: RoutineBlock = { id: "c", title: "Almoço", start: "13:00", end: "14:00", days: ["MO", "TU", "WE", "TH", "FR"] };
const blocks = [almoco, acordar, academia];

describe("validação", () => {
  it("fim depois do começo, horário válido", () => {
    expect(routineBlockSchema.safeParse({ ...academia, end: "07:00" }).success).toBe(false);
    expect(routineBlockSchema.safeParse({ ...academia, start: "25:00" }).success).toBe(false);
    expect(routineBlockSchema.safeParse({ ...academia, title: "  " }).success).toBe(false);
    expect(routineBlockSchema.safeParse(academia).success).toBe(true);
  });

  it("ignora bloco estragado ao ler", () => {
    expect(parseRoutineBlocks([academia, { id: "x" }, "lixo"])).toEqual([academia]);
    expect(parseRoutineBlocks(null)).toEqual([]);
  });
});

describe("blocos do dia", () => {
  it("filtra pelos dias e ordena pelo horário", () => {
    expect(blocksForDate(blocks, TODAY).map((b) => b.id)).toEqual(["a", "b", "c"]);
    expect(blocksForDate(blocks, "2026-09-29").map((b) => b.id)).toEqual(["a", "c"]); // terça
    expect(blocksForDate(blocks, "2026-10-04").map((b) => b.id)).toEqual(["a"]); // domingo
  });

  it("criar, editar e apagar", () => {
    const created = upsertBlock([academia], acordar);
    expect(created.map((b) => b.id)).toEqual(["a", "b"]);
    const edited = upsertBlock(created, { ...academia, start: "05:00", end: "05:45" });
    expect(edited.map((b) => b.id)).toEqual(["b", "a"]);
    expect(removeBlock(edited, "b").map((b) => b.id)).toEqual(["a"]);
  });

  it("descreve o horário", () => {
    expect(describeBlockTime(acordar)).toBe("6h");
    expect(describeBlockTime({ start: "08:30", end: "09:15" })).toBe("8h30–9h15");
  });
});

describe("routineNow", () => {
  it("bloco em andamento e o próximo", () => {
    expect(routineNow(blocks, TODAY, "08:20")).toEqual({ current: academia, next: almoco });
  });

  it("horário pontual vale por 30 min", () => {
    expect(routineNow(blocks, TODAY, "06:10").current).toBe(acordar);
    expect(routineNow(blocks, TODAY, "06:40")).toEqual({ current: null, next: academia });
  });

  it("depois do último, nada", () => {
    expect(routineNow(blocks, TODAY, "22:00")).toEqual({ current: null, next: null });
  });

  it("o fim do bloco já é fora dele", () => {
    expect(routineNow(blocks, TODAY, "09:00").current).toBeNull();
  });
});

describe("buildRoutineEntries (Agenda)", () => {
  it("gera cada ocorrência no fuso da dona, só leitura", () => {
    // Semana de 28/09 a 04/10 em São Paulo (UTC-3).
    const entries = buildRoutineEntries([academia], "2026-09-28T03:00:00.000Z", "2026-10-05T03:00:00.000Z", "America/Sao_Paulo");
    expect(entries.map((e) => e.start)).toEqual(["2026-09-28T11:00:00.000Z", "2026-09-30T11:00:00.000Z", "2026-10-02T11:00:00.000Z"]);
    expect(entries[0]).toMatchObject({ id: "routine:b:2026-09-28", title: "Academia", end: "2026-09-28T12:00:00.000Z", editable: false, kind: "routine", href: "/rotina" });
  });

  it("fora do intervalo não entra; sem blocos, nada", () => {
    const entries = buildRoutineEntries([acordar], "2026-09-30T10:00:00.000Z", "2026-10-01T03:00:00.000Z", "America/Sao_Paulo");
    expect(entries).toEqual([]); // 06:00 local = 09:00Z, antes do começo
    expect(buildRoutineEntries([], "2026-09-28T03:00:00.000Z", "2026-10-05T03:00:00.000Z", "America/Sao_Paulo")).toEqual([]);
  });
});
