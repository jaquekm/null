import { describe, expect, it } from "vitest";
import { buildTemplateVars, extractTemplateVariables, findUnknownTemplateVariables, renderTemplate } from "./render-template";

describe("extractTemplateVariables", () => {
  it("encontra variáveis sem repetição, ignorando espaços dentro das chaves", () => {
    expect(extractTemplateVariables("Oi {{ nome }}, sua consulta é {{data}} às {{hora}}. {{nome}} confirma?")).toEqual([
      "nome",
      "data",
      "hora",
    ]);
  });

  it("template sem variáveis: lista vazia", () => {
    expect(extractTemplateVariables("Mensagem fixa, sem variáveis.")).toEqual([]);
  });
});

describe("findUnknownTemplateVariables", () => {
  it("variáveis fixas não são desconhecidas", () => {
    expect(findUnknownTemplateVariables("{{nome}} {{data}} {{hora}} {{valor}}", [])).toEqual([]);
  });

  it("variável extra declarada em reminders.variables não é desconhecida", () => {
    expect(findUnknownTemplateVariables("Placa {{placa}}", ["placa"])).toEqual([]);
  });

  it("variável não fixa e não declarada: desconhecida", () => {
    expect(findUnknownTemplateVariables("{{nome}} {{apelido_do_pet}}", [])).toEqual(["apelido_do_pet"]);
  });
});

describe("renderTemplate", () => {
  it("substitui todas as ocorrências de uma variável conhecida", () => {
    expect(renderTemplate("Oi {{nome}}! Até mais, {{nome}}.", { nome: "Ana" })).toBe("Oi Ana! Até mais, Ana.");
  });

  it("variável sem valor correspondente é deixada como está", () => {
    expect(renderTemplate("Oi {{nome}}, {{desconhecida}}", { nome: "Ana" })).toBe("Oi Ana, {{desconhecida}}");
  });
});

describe("buildTemplateVars", () => {
  const base = {
    title: "Consulta",
    occurrenceAt: new Date("2026-01-15T12:00:00.000Z"), // 09:00 em São Paulo
    timezone: "America/Sao_Paulo",
  };

  it("contato com apelido: nome = apelido", () => {
    const vars = buildTemplateVars({ ...base, recipient: { nickname: "Bia", name: "Beatriz Souza" } });
    expect(vars.nome).toBe("Bia");
    expect(vars.nome_completo).toBe("Beatriz Souza");
  });

  it("contato sem apelido: nome = primeiro nome", () => {
    const vars = buildTemplateVars({ ...base, recipient: { nickname: null, name: "Beatriz Souza" } });
    expect(vars.nome).toBe("Beatriz");
  });

  it("destinatário é o dono (sem recipient): nome e nome_completo vazios", () => {
    const vars = buildTemplateVars(base);
    expect(vars.nome).toBe("");
    expect(vars.nome_completo).toBe("");
  });

  it("data, hora e dia_semana no fuso do lembrete", () => {
    const vars = buildTemplateVars(base); // 2026-01-15 é quinta
    expect(vars.data).toBe("15/01/2026");
    expect(vars.hora).toBe("09:00");
    expect(vars.dia_semana).toBe("quinta-feira");
  });

  it("valor formatado em reais a partir de centavos", () => {
    const vars = buildTemplateVars({ ...base, amountCents: 15090 });
    expect(vars.valor).toBe("R$ 150,90");
  });

  it("sem valor: string vazia", () => {
    expect(buildTemplateVars(base).valor).toBe("");
  });

  it("link e título", () => {
    const vars = buildTemplateVars({ ...base, link: "https://example.com/x" });
    expect(vars.link).toBe("https://example.com/x");
    expect(vars.titulo).toBe("Consulta");
  });

  it("variáveis extras (reminders.variables) são incluídas", () => {
    const vars = buildTemplateVars({ ...base, extra: { placa: "ABC-1234" } });
    expect(vars.placa).toBe("ABC-1234");
  });
});
