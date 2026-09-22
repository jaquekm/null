import { describe, expect, it } from "vitest";
import { matchesTrigger, scopeMatches } from "./match-trigger";

describe("matchesTrigger", () => {
  it("item_created bate com qualquer evento item_created", () => {
    expect(matchesTrigger({ type: "item_created" }, { type: "item_created" })).toBe(true);
  });

  it("property_changed exige o mesmo field; to/from só quando declarados", () => {
    const trigger = { type: "property_changed" as const, field: "stage", to: "won" };
    expect(matchesTrigger(trigger, { type: "property_changed", field: "stage", to: "won", from: "novo" })).toBe(true);
    expect(matchesTrigger(trigger, { type: "property_changed", field: "stage", to: "lost", from: "novo" })).toBe(false);
    expect(matchesTrigger(trigger, { type: "property_changed", field: "outro", to: "won", from: "novo" })).toBe(false);
  });

  it("property_changed sem to/from bate com qualquer mudança do campo", () => {
    const trigger = { type: "property_changed" as const, field: "stage" };
    expect(matchesTrigger(trigger, { type: "property_changed", field: "stage", to: "x", from: "y" })).toBe(true);
  });

  it("status_changed exige o mesmo destino", () => {
    expect(matchesTrigger({ type: "status_changed", to: "archived" }, { type: "status_changed", to: "archived" })).toBe(true);
    expect(matchesTrigger({ type: "status_changed", to: "archived" }, { type: "status_changed", to: "active" })).toBe(false);
  });

  it("tag_added exige a mesma tag", () => {
    expect(matchesTrigger({ type: "tag_added", tag: "urgente" }, { type: "tag_added", tag: "urgente" })).toBe(true);
    expect(matchesTrigger({ type: "tag_added", tag: "urgente" }, { type: "tag_added", tag: "outra" })).toBe(false);
  });

  it("tipos de gatilho/evento diferentes nunca batem", () => {
    expect(matchesTrigger({ type: "status_changed", to: "won" }, { type: "item_created" })).toBe(false);
  });
});

describe("scopeMatches", () => {
  it("automação sem escopo (typeId/spaceId nulos) bate com qualquer item", () => {
    expect(scopeMatches({ typeId: null, spaceId: null }, { typeId: "t1", spaceId: "s1" })).toBe(true);
  });

  it("typeId declarado precisa bater", () => {
    expect(scopeMatches({ typeId: "t1", spaceId: null }, { typeId: "t1", spaceId: "s1" })).toBe(true);
    expect(scopeMatches({ typeId: "t1", spaceId: null }, { typeId: "t2", spaceId: "s1" })).toBe(false);
  });

  it("spaceId declarado precisa bater", () => {
    expect(scopeMatches({ typeId: null, spaceId: "s1" }, { typeId: "t1", spaceId: "s1" })).toBe(true);
    expect(scopeMatches({ typeId: null, spaceId: "s1" }, { typeId: "t1", spaceId: "s2" })).toBe(false);
  });
});
