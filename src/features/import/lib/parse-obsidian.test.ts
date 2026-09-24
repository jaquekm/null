import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseObsidianFile, parseObsidianVault } from "./parse-obsidian";

const fixturePath = path.join(process.cwd(), "tests/fixtures/import/sample-obsidian-note.md");
const fixture = readFileSync(fixturePath, "utf-8");

describe("parseObsidianFile (fixture .md)", () => {
  it("lê título, tags (front matter + inline), datas e preserva o wikilink do fixture", () => {
    const item = parseObsidianFile({ path: "reuniao-de-terca.md", content: fixture }, "local-fixture");
    expect(item.title).toBe("Reunião de terça");
    expect(item.tags.sort()).toEqual(["cliente-x", "trabalho", "urgente"]);
    expect(item.createdAt).toBe(new Date("2026-02-03T10:00:00.000Z").toISOString());
    expect(item.updatedAt).toBe(new Date("2026-02-04T08:30:00.000Z").toISOString());
    expect(item.bodyMarkdown).toContain("[[Projeto Alfa]]");
    expect(item.bodyMarkdown).toContain("- [ ] Enviar proposta");
    expect(item.bodyMarkdown).toContain("- [x] Confirmar horário");
  });
});

describe("parseObsidianFile", () => {
  it("título do front matter, tags da lista + inline, datas ISO", () => {
    const content = ["---", "title: Reunião de terça", "tags: [trabalho, urgente]", "created: 2026-01-10", "---", "Pauta #importante aqui."].join("\n");
    const item = parseObsidianFile({ path: "Notas/reuniao.md", content }, "local-1");
    expect(item.title).toBe("Reunião de terça");
    expect(item.tags.sort()).toEqual(["importante", "trabalho", "urgente"]);
    expect(item.createdAt).toBe(new Date("2026-01-10").toISOString());
    expect(item.bodyMarkdown).toBe("Pauta #importante aqui.");
  });

  it("sem front matter: título vem do nome do arquivo", () => {
    const item = parseObsidianFile({ path: "Ideias soltas.md", content: "Só um texto solto." }, "local-2");
    expect(item.title).toBe("Ideias soltas");
    expect(item.tags).toEqual([]);
    expect(item.createdAt).toBeNull();
  });

  it("preserva [[wikilinks]] no corpo (resolvidos só depois, numa segunda passada)", () => {
    const item = parseObsidianFile({ path: "a.md", content: "Ver [[Projeto Alfa]]." }, "local-3");
    expect(item.bodyMarkdown).toContain("[[Projeto Alfa]]");
  });
});

describe("parseObsidianVault", () => {
  it("ignora arquivos que não são .md e avisa", () => {
    const result = parseObsidianVault([
      { path: "a.md", content: "A" },
      { path: "imagem.png", content: "" },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it("vault sem nada além de .md: sem avisos", () => {
    const result = parseObsidianVault([{ path: "a.md", content: "A" }]);
    expect(result.warnings).toHaveLength(0);
  });
});
