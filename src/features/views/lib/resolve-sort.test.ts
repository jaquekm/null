import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import { resolveSort } from "./resolve-sort";

const numberField: FieldDefinition = { key: "preco", label: "Preço", type: "money", required: false };

describe("resolveSort", () => {
  it("asc vira ascending true", () => {
    expect(resolveSort({ field: "title", dir: "asc" })).toEqual({ column: "title", ascending: true });
  });

  it("desc vira ascending false", () => {
    expect(resolveSort({ field: "updated_at", dir: "desc" })).toEqual({ column: "updated_at", ascending: false });
  });

  it("campo numérico de properties usa a mesma coluna com cast do filtro", () => {
    expect(resolveSort({ field: "preco", dir: "desc" }, numberField)).toEqual({
      column: "properties->>preco::numeric",
      ascending: false,
    });
  });
});
