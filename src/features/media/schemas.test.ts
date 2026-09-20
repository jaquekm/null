import { describe, expect, it } from "vitest";
import { meetingSummarySchema } from "./schemas";

const validSummary = {
  titulo_sugerido: "Reunião de planejamento",
  resumo: "Discutimos o roadmap do trimestre e definimos as próximas entregas.",
  topicos: [{ titulo: "Roadmap", pontos: ["Ponto 1", "Ponto 2"], inicio: "00:01:00" }],
  decisoes: ["Adiar o lançamento em duas semanas"],
  acoes: [{ descricao: "Atualizar o cronograma", responsavel: "João", prazo: "2026-10-01" }],
  perguntas_em_aberto: ["Quem fala com o cliente?"],
  participantes_mencionados: ["João", "Maria"],
};

describe("meetingSummarySchema", () => {
  it("aceita uma resposta válida completa", () => {
    expect(meetingSummarySchema.safeParse(validSummary).success).toBe(true);
  });

  it("aceita ações e tópicos sem os campos opcionais (responsavel/prazo nulos, sem inicio)", () => {
    const result = meetingSummarySchema.safeParse({
      ...validSummary,
      topicos: [{ titulo: "Roadmap", pontos: [] }],
      acoes: [{ descricao: "Atualizar o cronograma", responsavel: null, prazo: null }],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta um campo obrigatório (titulo_sugerido)", () => {
    const { titulo_sugerido: _omitted, ...rest } = validSummary;
    expect(meetingSummarySchema.safeParse(rest).success).toBe(false);
  });

  it("rejeita quando 'decisoes' não é um array de strings", () => {
    const result = meetingSummarySchema.safeParse({ ...validSummary, decisoes: "Adiar o lançamento" });
    expect(result.success).toBe(false);
  });

  it("rejeita quando 'prazo' de uma ação é número em vez de string/null", () => {
    const result = meetingSummarySchema.safeParse({
      ...validSummary,
      acoes: [{ descricao: "Atualizar o cronograma", responsavel: null, prazo: 20261001 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita 'acoes' sem o campo 'descricao'", () => {
    const result = meetingSummarySchema.safeParse({
      ...validSummary,
      acoes: [{ responsavel: null, prazo: null }],
    });
    expect(result.success).toBe(false);
  });
});
