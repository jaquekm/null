import { describe, expect, it } from "vitest";
import { splitLinks } from "./linkify";

describe("splitLinks", () => {
  it("marca os links e deixa o resto como texto", () => {
    expect(splitLinks("Site: https://pousada.com/quartos?x=1 — ótima")).toEqual([
      { text: "Site: " },
      { text: "https://pousada.com/quartos?x=1", href: "https://pousada.com/quartos?x=1" },
      { text: " — ótima" },
    ]);
  });

  it("www. vira https, e pontuação no fim não entra no link", () => {
    expect(splitLinks("veja www.booking.com.")).toEqual([{ text: "veja " }, { text: "www.booking.com", href: "https://www.booking.com" }, { text: "." }]);
  });

  it("texto sem link volta inteiro", () => {
    expect(splitLinks("R$ 450 a diária")).toEqual([{ text: "R$ 450 a diária" }]);
    expect(splitLinks("")).toEqual([]);
  });
});
