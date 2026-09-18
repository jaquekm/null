import { describe, expect, it } from "vitest";
import { fieldDefinitionSchema } from "@/features/types/schemas";
import { SYSTEM_TYPE_SEEDS } from "./system-types";

describe("SYSTEM_TYPE_SEEDS", () => {
  it("tem os 6 tipos básicos da tarefa 1.3, cada um com slug único", () => {
    const slugs = SYSTEM_TYPE_SEEDS.map((seed) => seed.slug);
    expect(slugs).toEqual(["nota", "tarefa", "documento", "referencia", "ideia", "reuniao"]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("todo campo de todo tipo é uma fieldDefinitionSchema válida", () => {
    for (const seed of SYSTEM_TYPE_SEEDS) {
      for (const field of seed.fields) {
        expect(fieldDefinitionSchema.safeParse(field).success).toBe(true);
      }
    }
  });

  it("nota não tem campos", () => {
    expect(SYSTEM_TYPE_SEEDS.find((s) => s.slug === "nota")?.fields).toEqual([]);
  });

  it("tarefa tem status, prazo e prioridade", () => {
    const tarefa = SYSTEM_TYPE_SEEDS.find((s) => s.slug === "tarefa");
    expect(tarefa?.fields.map((f) => f.key)).toEqual(["status", "prazo", "prioridade"]);
  });

  it("ideia tem rating de potencial entre 1 e 5", () => {
    const ideia = SYSTEM_TYPE_SEEDS.find((s) => s.slug === "ideia");
    const potencial = ideia?.fields[0];
    expect(potencial).toMatchObject({ key: "potencial", type: "rating", min: 1, max: 5 });
  });
});
