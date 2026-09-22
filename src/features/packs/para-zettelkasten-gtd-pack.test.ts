import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (5.11, `packs/para-zettelkasten-gtd.json`) contra o `packSchema` (5.2). */
describe("packs/para-zettelkasten-gtd.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "para-zettelkasten-gtd.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("declara os 4 espaços do método PARA", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "para-zettelkasten-gtd.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    expect(pack.spaces.map((s) => s.name)).toEqual(["Projetos", "Áreas", "Recursos", "Arquivo"]);
  });

  it("a automação de arquivar projeto mira o tipo Projeto de outro pack por typeSlug, não typeRef", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "para-zettelkasten-gtd.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const automation = pack.automations.find((a) => a.ref === "para_projeto_concluido_arquivo");
    expect(automation?.typeSlug).toBe("projeto");
    expect(automation?.typeRef).toBeUndefined();
  });

  it("a Tarefa deste pack estende o tipo de sistema (extendsSlug), igual o pack Projetos", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "para-zettelkasten-gtd.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const task = pack.types.find((t) => t.ref === "task");
    expect(task?.extendsSlug).toBe("tarefa");
  });
});
