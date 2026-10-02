import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateFormula } from "@/features/types/lib/formula";
import { packSchema } from "./schemas";

/** Valida o pack shipado (10.13, `packs/desejos.json`) contra o `packSchema` (5.2). */
describe("packs/desejos.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "desejos.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("slug \"desejo\" não colide com outro tipo", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "desejos.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const wish = pack.types.find((t) => t.ref === "wish");
    expect(wish?.slug).toBe("desejo");
  });

  it("\"meses_restantes\" é uma fórmula válida sobre meta/guardado/aporte_mensal", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "desejos.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const wish = pack.types.find((t) => t.ref === "wish")!;
    const formulaField = wish.fields.find((f) => f.key === "meses_restantes")!;
    expect(formulaField.type).toBe("formula");
    // `validateFormula` espera `FieldDefinition[]` (relationTypeId como uuid) — o pack usa `ref`
    // em vez de uuid real, mas a fórmula não referencia nenhum campo de relação, então o cast é seguro aqui.
    const fields = wish.fields as unknown as Parameters<typeof validateFormula>[1];
    const error = validateFormula(formulaField.formula!, fields, formulaField.key);
    expect(error).toBeNull();
  });
});
