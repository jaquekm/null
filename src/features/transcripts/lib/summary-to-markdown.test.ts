import { describe, expect, it } from "vitest";
import type { MeetingSummary } from "@/features/media/schemas";
import { summaryToMarkdown } from "./summary-to-markdown";

const summary: MeetingSummary = {
  titulo_sugerido: "Reunião de planejamento",
  resumo: "Discutimos o roadmap.",
  topicos: [{ titulo: "Roadmap", pontos: ["Ponto 1"], inicio: "00:01:00" }],
  decisoes: ["Adiar o lançamento"],
  acoes: [{ descricao: "Atualizar cronograma", responsavel: "João", prazo: "2026-10-01" }],
  perguntas_em_aberto: ["Quem fala com o cliente?"],
  participantes_mencionados: ["João"],
};

describe("summaryToMarkdown", () => {
  it("monta um markdown com título, resumo e todas as seções", () => {
    const md = summaryToMarkdown(summary);
    expect(md).toContain("# Reunião de planejamento");
    expect(md).toContain("Discutimos o roadmap.");
    expect(md).toContain("## Tópicos");
    expect(md).toContain("### Roadmap (00:01:00)");
    expect(md).toContain("- Ponto 1");
    expect(md).toContain("## Decisões");
    expect(md).toContain("- Adiar o lançamento");
    expect(md).toContain("## Ações");
    expect(md).toContain("- [ ] Atualizar cronograma (João, prazo 2026-10-01)");
    expect(md).toContain("## Perguntas em aberto");
    expect(md).toContain("- Quem fala com o cliente?");
  });

  it("seções vazias não aparecem", () => {
    const md = summaryToMarkdown({ ...summary, decisoes: [], acoes: [], perguntas_em_aberto: [] });
    expect(md).not.toContain("## Decisões");
    expect(md).not.toContain("## Ações");
    expect(md).not.toContain("## Perguntas em aberto");
  });
});
