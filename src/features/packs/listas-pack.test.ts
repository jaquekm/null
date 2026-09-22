import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (5.9, `packs/listas.json`) contra o `packSchema` (5.2). */
describe("packs/listas.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "listas.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("os 5 templates de lista vêm com conteúdo (checklist) pré-preenchido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "listas.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    expect(pack.sampleItems).toHaveLength(5);
    for (const sample of pack.sampleItems) {
      expect(sample.content).toBeTruthy();
    }
  });
});
