import { describe, expect, it } from "vitest";
import { buildImproveTextSystem } from "./improve-text";

describe("buildImproveTextSystem", () => {
  it("revisar: pede correção sem mudar sentido/tom", () => {
    expect(buildImproveTextSystem("revisar")).toMatch(/Revise a ortografia e a gramática/);
  });

  it("encurtar: pede texto mais curto mantendo o essencial", () => {
    expect(buildImproveTextSystem("encurtar")).toMatch(/Encurte o texto/);
  });

  it("formal: pede tom mais formal", () => {
    expect(buildImproveTextSystem("formal")).toMatch(/tom mais formal/);
  });

  it("traduzir: usa o idioma pedido (inglês por padrão)", () => {
    expect(buildImproveTextSystem("traduzir")).toMatch(/para inglês/);
    expect(buildImproveTextSystem("traduzir", "es")).toMatch(/para espanhol/);
  });

  it("todas as ações instruem a devolver só o texto, sem comentário", () => {
    for (const action of ["revisar", "encurtar", "formal", "traduzir"] as const) {
      expect(buildImproveTextSystem(action)).toMatch(/Devolva só o texto/);
    }
  });
});
