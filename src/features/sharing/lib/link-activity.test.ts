import { describe, expect, it } from "vitest";
import { linkActivityLabel, mergeLinkActivity, type LinkActivity } from "./link-activity";

const base: LinkActivity = { id: "1", kind: "comment", author: "Ana", text: "Adorei a ideia do livro!", itemId: "i1", itemTitle: "Presentes pra cunhada", createdAt: "2026-09-30T10:00:00Z" };

describe("linkActivityLabel", () => {
  it("comentário", () => {
    expect(linkActivityLabel(base)).toBe("Ana comentou em “Presentes pra cunhada”: “Adorei a ideia do livro!”");
    expect(linkActivityLabel({ ...base, author: " ", itemTitle: null })).toBe("Alguém comentou: “Adorei a ideia do livro!”");
  });

  it("marcação e desmarcação", () => {
    expect(linkActivityLabel({ ...base, kind: "check", author: null, text: "Leite", itemTitle: "Mercado" })).toBe("Marcaram “Leite” em “Mercado”");
    expect(linkActivityLabel({ ...base, kind: "uncheck", author: null, text: null, itemTitle: "Mercado" })).toBe("Desmarcaram um item em “Mercado”");
  });

  it("link de edição: diz quem fez o quê", () => {
    const edit = { ...base, author: "Ana", text: "Kart", itemTitle: "Rolês" };
    expect(linkActivityLabel({ ...edit, kind: "add" })).toBe("Ana adicionou “Kart” em “Rolês”");
    expect(linkActivityLabel({ ...edit, kind: "rate" })).toBe("Ana deu nota em “Kart” em “Rolês”");
    expect(linkActivityLabel({ ...edit, kind: "edit" })).toBe("Ana editou “Kart” em “Rolês”");
    expect(linkActivityLabel({ ...edit, kind: "delete" })).toBe("Ana apagou “Kart” em “Rolês”");
    expect(linkActivityLabel({ ...edit, kind: "check" })).toBe("Ana marcou “Kart” em “Rolês”");
    expect(linkActivityLabel({ ...edit, kind: "uncheck", author: null })).toBe("Desmarcaram “Kart” em “Rolês”");
  });

  it("corta texto longo", () => {
    const label = linkActivityLabel({ ...base, text: "a".repeat(200) });
    expect(label.endsWith("…”")).toBe(true);
    expect(label.length).toBeLessThan(140);
  });
});

describe("mergeLinkActivity", () => {
  it("mais recentes primeiro, das duas fontes", () => {
    const merged = mergeLinkActivity([base], [{ ...base, id: "2", kind: "check", createdAt: "2026-09-30T11:00:00Z" }, { ...base, id: "3", kind: "check", createdAt: "2026-09-30T09:00:00Z" }]);
    expect(merged.map((a) => a.id)).toEqual(["2", "1", "3"]);
  });
});
