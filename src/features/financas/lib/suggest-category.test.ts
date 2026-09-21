import { describe, expect, it } from "vitest";
import { suggestCategoryId, type RecentTransactionForSuggestion } from "./suggest-category";

describe("suggestCategoryId", () => {
  it("descrição idêntica (ignorando maiúsculas/acentos): sugere a categoria", () => {
    const recent: RecentTransactionForSuggestion[] = [{ description: "Pão de Açúcar", categoryId: "cat-mercado", occurredOn: "2026-09-10" }];
    expect(suggestCategoryId(recent, "pao de acucar")).toBe("cat-mercado");
  });

  it("descrição nova contém a antiga: sugere a categoria (ex.: nome completo do estabelecimento)", () => {
    const recent: RecentTransactionForSuggestion[] = [{ description: "Uber", categoryId: "cat-transporte", occurredOn: "2026-09-10" }];
    expect(suggestCategoryId(recent, "Uber *Trip help.uber.com")).toBe("cat-transporte");
  });

  it("descrição antiga contém a nova: também sugere", () => {
    const recent: RecentTransactionForSuggestion[] = [{ description: "Uber *Trip help.uber.com", categoryId: "cat-transporte", occurredOn: "2026-09-10" }];
    expect(suggestCategoryId(recent, "uber")).toBe("cat-transporte");
  });

  it("usa a primeira da lista que bater (lista já vem da mais recente pra mais antiga)", () => {
    const recent: RecentTransactionForSuggestion[] = [
      { description: "Mercado Livre", categoryId: "cat-recente", occurredOn: "2026-09-15" },
      { description: "Mercado Livre", categoryId: "cat-antiga", occurredOn: "2026-08-01" },
    ];
    expect(suggestCategoryId(recent, "mercado livre")).toBe("cat-recente");
  });

  it("nenhuma parecida: retorna null", () => {
    const recent: RecentTransactionForSuggestion[] = [{ description: "Farmácia São João", categoryId: "cat-saude", occurredOn: "2026-09-10" }];
    expect(suggestCategoryId(recent, "Posto Ipiranga")).toBeNull();
  });

  it("termo muito curto (menos de 3 caracteres): não arrisca sugestão", () => {
    const recent: RecentTransactionForSuggestion[] = [{ description: "Ab", categoryId: "cat-x", occurredOn: "2026-09-10" }];
    expect(suggestCategoryId(recent, "ab")).toBeNull();
  });

  it("lista vazia: retorna null", () => {
    expect(suggestCategoryId([], "mercado")).toBeNull();
  });
});
