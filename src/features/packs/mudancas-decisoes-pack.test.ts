import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (5.10, `packs/mudancas-decisoes.json`) contra o `packSchema` (5.2). */
describe("packs/mudancas-decisoes.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "mudancas-decisoes.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("o Documento de processo (SOP) estende o tipo de sistema Documento", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "mudancas-decisoes.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const sop = pack.types.find((type) => type.ref === "sop");
    expect(sop?.extendsSlug).toBe("documento");
  });

  it("Decisão.superseded_by é uma auto-relação (ref \"decision\")", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "mudancas-decisoes.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const decision = pack.types.find((type) => type.ref === "decision");
    const supersededBy = decision?.fields.find((field) => field.key === "superseded_by");
    expect(supersededBy?.relationTypeId).toBe("decision");
  });
});
