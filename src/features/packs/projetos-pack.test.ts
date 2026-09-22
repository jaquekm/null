import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packSchema } from "./schemas";

/** Valida o pack shipado (5.8, `packs/projetos.json`) contra o `packSchema` (5.2). */
describe("packs/projetos.json", () => {
  it("é um pack válido", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "projetos.json"), "utf-8");
    const parsed = packSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(parsed.error.flatten());
    }
    expect(parsed.success).toBe(true);
  });

  it("o tipo Tarefa estende o tipo de sistema (extendsSlug), não cria um novo", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "projetos.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const task = pack.types.find((type) => type.ref === "task");
    expect(task?.extendsSlug).toBe("tarefa");
  });

  it("o campo rollup de progresso do Projeto aponta pro ref \"task\" e pro campo \"project\"", async () => {
    const raw = await readFile(path.join(process.cwd(), "packs", "projetos.json"), "utf-8");
    const pack = packSchema.parse(JSON.parse(raw));
    const project = pack.types.find((type) => type.ref === "project");
    const progress = project?.fields.find((field) => field.key === "progress");
    expect(progress?.type).toBe("rollup");
    expect(progress?.rollupRelationTypeId).toBe("task");
    expect(progress?.rollupRelationField).toBe("project");
  });
});
