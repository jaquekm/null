import { describe, expect, it } from "vitest";
import { buildReviewSummaryDoc, type ReviewSummaryInput } from "./build-review-summary";

function baseInput(overrides: Partial<ReviewSummaryInput> = {}): ReviewSummaryInput {
  return {
    inbox: [],
    projectsInProgress: [],
    overdueTasks: [],
    nextWeekAgenda: [],
    billsThisWeek: [],
    notes: "",
    ...overrides,
  };
}

function headings(doc: ReturnType<typeof buildReviewSummaryDoc>): string[] {
  return doc.filter((node) => node.type === "heading").map((node) => node.content?.[0]?.text as string);
}

describe("buildReviewSummaryDoc", () => {
  it("tem uma seção por passo, nessa ordem", () => {
    expect(headings(buildReviewSummaryDoc(baseInput()))).toEqual([
      "Inbox",
      "Projetos em andamento",
      "Tarefas atrasadas",
      "Agenda da próxima semana",
      "Contas da semana",
      "Notas livres",
    ]);
  });

  it("passo com itens vira lista com os títulos", () => {
    const doc = buildReviewSummaryDoc(baseInput({ inbox: [{ id: "1", title: "Nota solta", contentText: "", source: "manual", spaceId: null, typeId: null, createdAt: "", updatedAt: "", tags: [] }] }));
    const inboxList = doc[1];
    expect(inboxList?.type).toBe("bulletList");
    expect(inboxList?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("Nota solta");
  });

  it("passo vazio mostra a mensagem de vazio, não uma lista", () => {
    const doc = buildReviewSummaryDoc(baseInput());
    expect(doc[1]?.type).toBe("paragraph");
    expect(doc[1]?.content?.[0]?.text).toBe("Inbox zerada.");
  });

  it("projectsInProgress null (pack não instalado) mostra aviso em vez de lista vazia", () => {
    const doc = buildReviewSummaryDoc(baseInput({ projectsInProgress: null }));
    const projectsParagraph = doc[3];
    expect(projectsParagraph?.type).toBe("paragraph");
    expect(projectsParagraph?.content?.[0]?.text).toBe("Pack Projetos não instalado.");
  });

  it("billsThisWeek null (módulo Finanças desligado) mostra aviso", () => {
    const doc = buildReviewSummaryDoc(baseInput({ billsThisWeek: null }));
    const billsParagraph = doc[9];
    expect(billsParagraph?.content?.[0]?.text).toBe("Módulo Finanças desligado.");
  });

  it("notas livres vazias viram um travessão", () => {
    const doc = buildReviewSummaryDoc(baseInput());
    const notesParagraph = doc[doc.length - 1];
    expect(notesParagraph?.content?.[0]?.text).toBe("—");
  });

  it("notas livres preenchidas aparecem no fim", () => {
    const doc = buildReviewSummaryDoc(baseInput({ notes: "Semana corrida, priorizar o projeto X." }));
    const notesParagraph = doc[doc.length - 1];
    expect(notesParagraph?.content?.[0]?.text).toBe("Semana corrida, priorizar o projeto X.");
  });
});
