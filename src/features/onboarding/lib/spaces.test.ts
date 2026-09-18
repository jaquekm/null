import { describe, expect, it } from "vitest";
import { buildSpaceRows } from "./spaces";

describe("buildSpaceRows", () => {
  it("converte rascunhos em linhas com slug e position sequenciais", () => {
    const rows = buildSpaceRows([
      { name: "Pessoal", icon: "🏠", color: "sky" },
      { name: "Trabalho", icon: "💼", color: "amber" },
    ]);
    expect(rows).toEqual([
      { name: "Pessoal", slug: "pessoal", icon: "🏠", color: "sky", position: 0 },
      { name: "Trabalho", slug: "trabalho", icon: "💼", color: "amber", position: 1 },
    ]);
  });

  it("ignora nomes vazios ou só espaço", () => {
    const rows = buildSpaceRows([{ name: "  " }, { name: "Estudos" }]);
    expect(rows).toEqual([{ name: "Estudos", slug: "estudos", icon: null, color: null, position: 0 }]);
  });

  it("gera slugs únicos quando dois nomes colidem", () => {
    const rows = buildSpaceRows([{ name: "Ideias" }, { name: "ideias" }, { name: "Ideias!!" }]);
    expect(rows.map((r) => r.slug)).toEqual(["ideias", "ideias-2", "ideias-3"]);
  });

  it("trata icon/color em branco como null", () => {
    const rows = buildSpaceRows([{ name: "Trabalho", icon: "  ", color: "" }]);
    expect(rows[0]).toMatchObject({ icon: null, color: null });
  });
});
