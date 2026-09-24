import { describe, expect, it } from "vitest";
import { parseGoogleKeepExport, parseGoogleKeepNote } from "./parse-google-keep";

describe("parseGoogleKeepNote", () => {
  it("nota de texto simples, com label e cor", () => {
    const item = parseGoogleKeepNote(
      {
        title: "Ideia",
        textContent: "Lembrar de ligar pro cliente",
        labels: [{ name: "Trabalho" }],
        color: "RED",
        createdTimestampUsec: 1_609_459_200_000_000,
        userEditedTimestampUsec: 1_609_545_600_000_000,
      },
      "keep-1",
    );
    expect(item.title).toBe("Ideia");
    expect(item.bodyMarkdown).toBe("Lembrar de ligar pro cliente");
    expect(item.tags).toEqual(["trabalho", "cor-red"]);
    expect(item.createdAt).toBe(new Date(1_609_459_200_000).toISOString());
    expect(item.updatedAt).toBe(new Date(1_609_545_600_000).toISOString());
  });

  it("checklist vira lista de tarefas em Markdown", () => {
    const item = parseGoogleKeepNote(
      { title: "Compras", listContent: [{ text: "Leite", isChecked: true }, { text: "Ovos", isChecked: false }] },
      "keep-2",
    );
    expect(item.bodyMarkdown).toBe("- [x] Leite\n- [ ] Ovos");
  });

  it("sem título: 'Sem título'; cor DEFAULT não vira tag", () => {
    const item = parseGoogleKeepNote({ textContent: "x", color: "DEFAULT" }, "keep-3");
    expect(item.title).toBe("Sem título");
    expect(item.tags).toEqual([]);
  });
});

describe("parseGoogleKeepExport", () => {
  it("ignora notas na lixeira e avisa", () => {
    const result = parseGoogleKeepExport([
      { path: "Takeout/Keep/nota1.json", content: JSON.stringify({ title: "A", textContent: "a" }) },
      { path: "Takeout/Keep/nota2.json", content: JSON.stringify({ title: "B", textContent: "b", isTrashed: true }) },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.title).toBe("A");
    expect(result.warnings).toEqual(["1 nota(s) na lixeira do Keep foram ignoradas."]);
  });

  it("JSON inválido gera aviso mas não quebra o resto", () => {
    const result = parseGoogleKeepExport([
      { path: "nota1.json", content: "{ isso não é json" },
      { path: "nota2.json", content: JSON.stringify({ title: "Ok" }) },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.warnings[0]).toContain("nota1.json");
  });

  it("ignora arquivos que não são .json", () => {
    const result = parseGoogleKeepExport([{ path: "foto.jpg", content: "" }]);
    expect(result.items).toHaveLength(0);
  });
});
