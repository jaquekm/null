import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (5.12, `packs/diario-habitos.json`) contra o `packSchema` (5.2). */
describe("packs/diario-habitos.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "diario-habitos.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("a visão do Diário é um calendário pelo campo date", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "diario-habitos.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const view = pack.views.find((v) => v.ref === "diario_calendario");
    expect(view?.kind).toBe("calendar");
    expect(view?.config.dateField).toBe("date");
  });

  it("o tipo Hábito não declara um campo \"log\" — o registro diário fica fora do editor genérico (5.12)", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "diario-habitos.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const habit = pack.types.find((t) => t.ref === "habit");
    expect(habit?.fields.some((f) => f.key === "log")).toBe(false);
  });
});
