import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (10.7, `packs/saude-registros.json`) contra o `packSchema` (5.2). */
describe("packs/saude-registros.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "saude-registros.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("a visão de Sintomas é um calendário pelo campo data", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "saude-registros.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const view = pack.views.find((v) => v.ref === "sintomas_calendario");
    expect(view?.kind).toBe("calendar");
    expect(view?.config.dateField).toBe("data");
  });

  it("Receita não declara campo de validade — usa a validade genérica (9.5)", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "saude-registros.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const prescription = pack.types.find((t) => t.ref === "prescription");
    expect(prescription?.fields.some((f) => f.key === "validade")).toBe(false);
  });
});
