import { describe, expect, it } from "vitest";
import type { MeetingSummary } from "@/features/media/schemas";
import { buildSummaryBlock } from "./build-summary-block";

const baseSummary: MeetingSummary = {
  titulo_sugerido: "Reunião de planejamento",
  resumo: "Discutimos o roadmap do trimestre.",
  topicos: [{ titulo: "Roadmap", pontos: ["Ponto 1", "Ponto 2"], inicio: "00:01:00" }],
  decisoes: ["Adiar o lançamento em duas semanas"],
  acoes: [{ descricao: "Atualizar o cronograma", responsavel: "João", prazo: "2026-10-01" }],
  perguntas_em_aberto: ["Quem fala com o cliente?"],
  participantes_mencionados: ["João", "Maria"],
};

describe("buildSummaryBlock", () => {
  it("começa com o cabeçalho 'Resumo gerado' e o parágrafo do resumo", () => {
    const nodes = buildSummaryBlock(baseSummary);
    expect(nodes[0]).toEqual({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Resumo gerado" }] });
    expect(nodes[1]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Discutimos o roadmap do trimestre." }],
    });
  });

  it("tópicos viram heading (com horário) + bulletList dos pontos", () => {
    const nodes = buildSummaryBlock(baseSummary);
    const topicoHeadingIndex = nodes.findIndex(
      (n) => n.type === "heading" && n.content?.[0]?.text === "Roadmap (00:01:00)",
    );
    expect(topicoHeadingIndex).toBeGreaterThan(-1);
    expect(nodes[topicoHeadingIndex + 1]).toMatchObject({
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Ponto 1" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Ponto 2" }] }] },
      ],
    });
  });

  it("ações viram taskList/taskItem não marcados, com responsável e prazo na linha", () => {
    const nodes = buildSummaryBlock(baseSummary);
    const taskList = nodes.find((n) => n.type === "taskList");
    expect(taskList).toMatchObject({
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Atualizar o cronograma (João) — prazo 2026-10-01" }] }],
        },
      ],
    });
  });

  it("ação sem responsável nem prazo mostra só a descrição", () => {
    const nodes = buildSummaryBlock({
      ...baseSummary,
      acoes: [{ descricao: "Revisar contrato", responsavel: null, prazo: null }],
    });
    const taskList = nodes.find((n) => n.type === "taskList");
    expect(taskList?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("Revisar contrato");
  });

  it("seções vazias (arrays vazios) não geram heading nem lista", () => {
    const nodes = buildSummaryBlock({
      ...baseSummary,
      topicos: [],
      decisoes: [],
      acoes: [],
      perguntas_em_aberto: [],
    });
    const headings = nodes.filter((n) => n.type === "heading").map((n) => n.content?.[0]?.text);
    expect(headings).toEqual(["Resumo gerado"]);
    expect(nodes).toHaveLength(2); // só o heading + o parágrafo do resumo
  });
});
