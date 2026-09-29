import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { findTemplate } from "@/features/templates/lib/templates";
import { mailtoAll, meetingShareMessage, nextStepsFromContent, whatsappLink } from "./next-steps";

const h = (text: string, level = 3): JSONContent => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const tasks = (...items: [string, boolean?][]): JSONContent => ({
  type: "taskList",
  content: items.map(([text, checked]) => ({ type: "taskItem", attrs: { checked: Boolean(checked) }, content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] })),
});

describe("nextStepsFromContent", () => {
  it("pega só os itens abertos da seção Próximos passos", () => {
    const doc = { type: "doc", content: [h("Pauta"), tasks(["Revisar orçamento"]), h("Próximos passos"), tasks(["Enviar proposta"], ["Já feito", true], [""], ["Ligar pro fornecedor"]), h("Outros"), tasks(["Fora da seção"])] };
    expect(nextStepsFromContent(doc)).toEqual(["Enviar proposta", "Ligar pro fornecedor"]);
  });

  it("aceita Ações/Tarefas/Encaminhamentos e subtítulos dentro da seção", () => {
    const doc = { type: "doc", content: [h("Encaminhamentos", 2), h("Financeiro", 3), tasks(["Pagar sinal"]), h("Fim", 2), tasks(["Não"])] };
    expect(nextStepsFromContent(doc)).toEqual(["Pagar sinal"]);
  });

  it("nota nova do modelo (próximos passos vazio) e nota nula não geram nada", () => {
    expect(nextStepsFromContent(findTemplate("reuniao")?.content ?? null)).toEqual([]);
    expect(nextStepsFromContent(null)).toEqual([]);
  });
});

describe("mensagem e links pros participantes", () => {
  const message = meetingShareMessage("Kickoff", "29/09", "https://x/p/abc");
  it("mensagem com nome, data e link", () => {
    expect(message).toBe("Resumo da reunião “Kickoff” (29/09): pauta, anotações e próximos passos neste link, sempre atualizado — https://x/p/abc");
    expect(meetingShareMessage(" ", null, "u")).toBe("Resumo da reunião “Reunião”: pauta, anotações e próximos passos neste link, sempre atualizado — u");
  });

  it("WhatsApp com só dígitos e e-mail único pra todos", () => {
    expect(whatsappLink("+55 (11) 99999-0000", "oi")).toBe("https://wa.me/5511999990000?text=oi");
    expect(whatsappLink(null, "oi")).toBe("https://wa.me/?text=oi");
    expect(mailtoAll([{ name: "A", phoneE164: null, email: "a@x.com" }, { name: "B", phoneE164: null, email: null }, { name: "C", phoneE164: null, email: " c@x.com " }], "Kickoff", "oi")).toBe(
      "mailto:a@x.com,c@x.com?subject=Kickoff&body=oi",
    );
    expect(mailtoAll([{ name: "B", phoneE164: null, email: null }], "s", "m")).toBeNull();
  });
});
