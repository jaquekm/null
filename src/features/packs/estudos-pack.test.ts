import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (5.7, `packs/estudos.json`) contra o `packSchema` (5.2) — pega corrupção/typo no JSON antes de chegar em produção. */
describe("packs/estudos.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "estudos.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });
});
