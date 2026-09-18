import { describe, expect, it } from "vitest";
import { diffLinks } from "./diff-links";

describe("diffLinks", () => {
  it("não adiciona nem remove quando as listas são iguais", () => {
    expect(diffLinks(["a", "b"], ["a", "b"])).toEqual({ add: [], remove: [] });
  });

  it("detecta ids adicionados", () => {
    expect(diffLinks(["a"], ["a", "b"])).toEqual({ add: ["b"], remove: [] });
  });

  it("detecta ids removidos", () => {
    expect(diffLinks(["a", "b"], ["a"])).toEqual({ add: [], remove: ["b"] });
  });

  it("detecta adição e remoção ao mesmo tempo", () => {
    expect(diffLinks(["a", "b"], ["b", "c"])).toEqual({ add: ["c"], remove: ["a"] });
  });

  it("lida com listas vazias", () => {
    expect(diffLinks([], [])).toEqual({ add: [], remove: [] });
    expect(diffLinks([], ["a"])).toEqual({ add: ["a"], remove: [] });
    expect(diffLinks(["a"], [])).toEqual({ add: [], remove: ["a"] });
  });
});
