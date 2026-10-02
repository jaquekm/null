import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLES, pendingPacksForBundle } from "./bundles";

describe("pendingPacksForBundle", () => {
  const bundle = BUNDLES.find((b) => b.key === "saude")!;

  it("sem nada instalado, os 2 packs do pacote faltam", () => {
    expect(pendingPacksForBundle(bundle, [])).toHaveLength(2);
  });

  it("pack já instalado (em qualquer espaço) não entra de novo", () => {
    const pending = pendingPacksForBundle(bundle, ["saude"]);
    expect(pending.map((p) => p.packKey)).toEqual(["saude-registros"]);
  });

  it("os 2 já instalados, nada falta", () => {
    expect(pendingPacksForBundle(bundle, ["saude", "saude-registros"])).toEqual([]);
  });
});

describe("BUNDLES", () => {
  it("toda chave de pacote é única", () => {
    const keys = BUNDLES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("todo packKey referenciado existe de verdade em packs/*.json", async () => {
    const dir = path.join(process.cwd(), "packs");
    const files = await readdir(dir);
    const realKeys = new Set(
      await Promise.all(files.filter((f) => f.endsWith(".json")).map(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf-8")).key as string)),
    );
    for (const bundle of BUNDLES) {
      for (const ref of bundle.packs) {
        expect(realKeys.has(ref.packKey), `"${bundle.key}" referencia pack inexistente "${ref.packKey}"`).toBe(true);
      }
    }
  });
});
