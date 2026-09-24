import { describe, expect, it } from "vitest";
import { extractText } from "@/features/items/lib/extract-text";
import { markdownToTiptapDoc } from "@/features/items/lib/markdown-to-tiptap";
import { MANUAL_DOCUMENTS } from "./manual-documents";

describe("MANUAL_DOCUMENTS", () => {
  it("são 3 documentos com títulos únicos e não vazios", () => {
    expect(MANUAL_DOCUMENTS).toHaveLength(3);
    const titles = MANUAL_DOCUMENTS.map((doc) => doc.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const doc of MANUAL_DOCUMENTS) {
      expect(doc.title.trim().length).toBeGreaterThan(0);
      expect(doc.markdown.trim().length).toBeGreaterThan(0);
    }
  });

  it("cada documento converte pra Tiptap com texto de verdade (não fica em branco)", () => {
    for (const doc of MANUAL_DOCUMENTS) {
      const content = markdownToTiptapDoc(doc.markdown);
      const text = extractText(content);
      expect(text.trim().length).toBeGreaterThan(100);
    }
  });

  it("runbook de incidentes referencia o guia de restauração", () => {
    const runbook = MANUAL_DOCUMENTS.find((doc) => doc.title === "Runbook de incidentes");
    expect(runbook?.markdown).toContain("docs/restauracao.md");
  });
});
