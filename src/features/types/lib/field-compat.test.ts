import { describe, expect, it } from "vitest";
import { canChangeFieldType } from "./field-compat";

describe("canChangeFieldType", () => {
  it("permite manter o mesmo tipo", () => {
    expect(canChangeFieldType("text", "text")).toBe(true);
  });

  it("permite text <-> long_text nos dois sentidos", () => {
    expect(canChangeFieldType("text", "long_text")).toBe(true);
    expect(canChangeFieldType("long_text", "text")).toBe(true);
  });

  it("permite number <-> percent <-> rating", () => {
    expect(canChangeFieldType("number", "percent")).toBe(true);
    expect(canChangeFieldType("percent", "rating")).toBe(true);
    expect(canChangeFieldType("rating", "number")).toBe(true);
  });

  it("permite select -> multi_select mas não o contrário", () => {
    expect(canChangeFieldType("select", "multi_select")).toBe(true);
    expect(canChangeFieldType("multi_select", "select")).toBe(false);
  });

  it("rejeita combinações incompatíveis", () => {
    expect(canChangeFieldType("text", "number")).toBe(false);
    expect(canChangeFieldType("checkbox", "date")).toBe(false);
    expect(canChangeFieldType("relation", "contact")).toBe(false);
  });
});
