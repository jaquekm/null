import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (10.10, `packs/receitas.json`) contra o `packSchema` (5.2). */
describe("packs/receitas.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "receitas.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("slug \"receita-culinaria\" não colide com a Receita médica (slug \"receita\", 10.7)", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "receitas.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const recipe = pack.types.find((t) => t.ref === "recipe");
    expect(recipe?.slug).toBe("receita-culinaria");
  });

  it("não declara \"ingredients\" como campo — fica fora do editor genérico (10.10)", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "receitas.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const recipe = pack.types.find((t) => t.ref === "recipe");
    expect(recipe?.fields.some((f) => f.key === "ingredients")).toBe(false);
  });
});
