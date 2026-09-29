import { describe, expect, it } from "vitest";
import { MOBILE_PRIMARY_ITEMS, NAV_ITEMS, SEARCH_ITEM } from "./nav-items";

describe("nav-items", () => {
  it("tem 13 itens na sidebar, todos com href e label únicos", () => {
    expect(NAV_ITEMS).toHaveLength(13);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(
      NAV_ITEMS.length,
    );
    expect(new Set(NAV_ITEMS.map((item) => item.label)).size).toBe(
      NAV_ITEMS.length,
    );
  });

  it("inclui Treinos (módulo próprio)", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/treinos")).toBe(true);
  });

  it("inclui Configurações, exigido pela tarefa 0.8", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/configuracoes")).toBe(true);
  });

  it("Buscar fica fora do menu — a busca do topo já busca e abre a Busca avançada", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/buscar")).toBe(false);
    expect(SEARCH_ITEM.href).toBe("/buscar");
  });

  it("começa por Hoje, a página inicial", () => {
    expect(NAV_ITEMS[0]?.href).toBe("/hoje");
  });

  it("a barra inferior do mobile mostra Hoje, Inbox e Agenda, nessa ordem", () => {
    expect(MOBILE_PRIMARY_ITEMS.map((item) => item.href)).toEqual([
      "/hoje",
      "/inbox",
      "/agenda",
    ]);
  });

  it("todo item da barra inferior também existe na sidebar", () => {
    const sidebarHrefs = new Set(NAV_ITEMS.map((item) => item.href));
    for (const item of MOBILE_PRIMARY_ITEMS) {
      expect(sidebarHrefs.has(item.href)).toBe(true);
    }
  });
});
