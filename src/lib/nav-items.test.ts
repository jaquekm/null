import { describe, expect, it } from "vitest";
import { MOBILE_PRIMARY_ITEMS, NAV_ITEMS } from "./nav-items";

describe("nav-items", () => {
  it("tem 8 itens na sidebar, todos com href e label únicos", () => {
    expect(NAV_ITEMS).toHaveLength(8);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(
      NAV_ITEMS.length,
    );
    expect(new Set(NAV_ITEMS.map((item) => item.label)).size).toBe(
      NAV_ITEMS.length,
    );
  });

  it("inclui Configurações, exigido pela tarefa 0.8", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/configuracoes")).toBe(true);
  });

  it("a barra inferior do mobile mostra Inbox, Buscar e Agenda, nessa ordem", () => {
    expect(MOBILE_PRIMARY_ITEMS.map((item) => item.href)).toEqual([
      "/inbox",
      "/buscar",
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
