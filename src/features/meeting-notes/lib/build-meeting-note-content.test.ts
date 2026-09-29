import { describe, expect, it } from "vitest";
import { buildMeetingNoteContent } from "./build-meeting-note-content";

describe("buildMeetingNoteContent", () => {
  it("sem template no tipo: nasce com pauta, anotações e próximos passos", () => {
    const doc = buildMeetingNoteContent(null, null, null);
    const headings = (doc.content ?? []).filter((node) => node.type === "heading").map((node) => node.content?.[0]?.text);
    expect(headings).toEqual(["Pauta", "Anotações", "Próximos passos"]);
    expect(doc.content?.some((node) => node.type === "taskList")).toBe(true);
  });

  it("template vazio no tipo conta como sem template", () => {
    const doc = buildMeetingNoteContent({ type: "doc", content: [] }, null, null);
    expect(doc.content?.[0]).toMatchObject({ type: "heading", content: [{ text: "Pauta" }] });
  });

  it("template do tipo entra primeiro", () => {
    const template = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Pauta" }] }] };
    const doc = buildMeetingNoteContent(template, null, null);
    expect(doc.content?.[0]).toEqual(template.content[0]);
  });

  it("link do Meet vira parágrafo com marca link", () => {
    const doc = buildMeetingNoteContent(null, "https://meet.google.com/abc-defg-hij", null);
    expect(doc.content).toContainEqual({
      type: "paragraph",
      content: [{ type: "text", marks: [{ type: "link", attrs: { href: "https://meet.google.com/abc-defg-hij" } }], text: "https://meet.google.com/abc-defg-hij" }],
    });
  });

  it("reunião anterior: título com link pro item", () => {
    const doc = buildMeetingNoteContent(null, null, { id: "item-1", title: "Reunião de kickoff", pendingActions: [] });
    expect(doc.content).toContainEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Última reunião com estes participantes" }],
    });
    expect(doc.content).toContainEqual({
      type: "paragraph",
      content: [{ type: "text", marks: [{ type: "link", attrs: { href: "/itens/item-1" } }], text: "Reunião de kickoff" }],
    });
  });

  // Com um template simples no tipo, pra estrutura padrão (que tem lista de pauta) não se misturar com a lista de pendências.
  const simple = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Notas" }] }] };

  it("reunião anterior com ações pendentes: vira lista", () => {
    const doc = buildMeetingNoteContent(simple, null, {
      id: "item-1",
      title: "Reunião de kickoff",
      pendingActions: [{ id: "a1", title: "Enviar proposta" }, { id: "a2", title: "Agendar follow-up" }],
    });
    const bulletList = doc.content?.find((node) => node.type === "bulletList");
    expect(bulletList).toBeDefined();
    expect(bulletList?.content).toHaveLength(2);
  });

  it("reunião anterior sem ações pendentes: sem lista", () => {
    const doc = buildMeetingNoteContent(simple, null, { id: "item-1", title: "Reunião", pendingActions: [] });
    expect(doc.content?.some((node) => node.type === "bulletList")).toBe(false);
  });

  it("combina template + Meet + reunião anterior, nessa ordem", () => {
    const template = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Pauta" }] }] };
    const doc = buildMeetingNoteContent(template, "https://meet.google.com/x", {
      id: "item-1",
      title: "Anterior",
      pendingActions: [],
    });
    expect(doc.content?.[0]).toEqual(template.content[0]);
    expect(doc.content?.[1]).toMatchObject({ type: "paragraph" });
    expect(doc.content?.some((node) => node.type === "heading")).toBe(true);
  });
});
