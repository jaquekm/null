import { describe, expect, it } from "vitest";
import { mealsProgress } from "./meal-slots";

describe("mealsProgress", () => {
  it("conta as marcadas", () => expect(mealsProgress({ cafe: true, almoco: true, jantar: false })).toEqual({ done: 2, total: 5 }));
  it("nenhuma marcada", () => expect(mealsProgress({})).toEqual({ done: 0, total: 5 }));
  it("todas marcadas", () =>
    expect(mealsProgress({ cafe: true, almoco: true, lanche: true, jantar: true, ceia: true })).toEqual({ done: 5, total: 5 }));
});
