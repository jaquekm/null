import { describe, expect, it } from "vitest";
import { importFingerprint, type FingerprintedItem } from "./import-fingerprint";

const base: FingerprintedItem = {
  title: "Nota",
  content_text: "texto",
  properties: { _import_id: "b1", categoria: "x" },
  space_id: "s1",
  type_id: null,
  status: "active",
};

describe("importFingerprint", () => {
  it("ordem das chaves das propriedades não importa (jsonb pode reordenar)", () => {
    expect(importFingerprint({ ...base, properties: { categoria: "x", _import_id: "b1" } })).toBe(importFingerprint(base));
  });

  it("muda quando o dono edita título, texto, propriedade, espaço ou status", () => {
    const original = importFingerprint(base);
    expect(importFingerprint({ ...base, title: "Nota editada" })).not.toBe(original);
    expect(importFingerprint({ ...base, content_text: "outro" })).not.toBe(original);
    expect(importFingerprint({ ...base, properties: { _import_id: "b1", categoria: "y" } })).not.toBe(original);
    expect(importFingerprint({ ...base, space_id: "s2" })).not.toBe(original);
    expect(importFingerprint({ ...base, status: "archived" })).not.toBe(original);
  });
});
