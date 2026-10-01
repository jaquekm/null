import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (10.5, `packs/saude.json`) contra o `packSchema` (5.2). */
describe("packs/saude.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "saude.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("o tipo Remédio não declara \"horarios\" nem \"stock\" — ficam fora do editor genérico (10.5)", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "saude.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const medication = pack.types.find((t) => t.ref === "medication");
    expect(medication?.fields.some((f) => f.key === "horarios" || f.key === "stock")).toBe(false);
  });
});
