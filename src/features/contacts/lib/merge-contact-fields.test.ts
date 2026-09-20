import { describe, expect, it } from "vitest";
import { mergeContactFields, type MergeableContact } from "./merge-contact-fields";

function contact(overrides: Partial<MergeableContact> = {}): MergeableContact {
  return {
    nickname: null,
    company: null,
    role: null,
    phone_e164: null,
    email: null,
    birthday: null,
    address: null,
    notes: null,
    avatar_path: null,
    space_id: null,
    ...overrides,
  };
}

describe("mergeContactFields", () => {
  it("preenche campos vazios do que fica com o valor do que é descartado", () => {
    const keep = contact({ email: "joao@example.com" });
    const discard = contact({ phone_e164: "+5511987654321", company: "Acme" });

    expect(mergeContactFields(keep, discard)).toEqual({
      phone_e164: "+5511987654321",
      company: "Acme",
    });
  });

  it("nunca sobrescreve um campo que o contato mantido já tinha preenchido", () => {
    const keep = contact({ email: "joao@example.com" });
    const discard = contact({ email: "outro@example.com" });

    expect(mergeContactFields(keep, discard)).toEqual({});
  });

  it("devolve objeto vazio quando o descartado não tem nada que o mantido não tenha", () => {
    const keep = contact({ email: "joao@example.com", company: "Acme" });
    const discard = contact();

    expect(mergeContactFields(keep, discard)).toEqual({});
  });

  it("string vazia conta como campo vazio, igual a null", () => {
    const keep = contact({ notes: "" });
    const discard = contact({ notes: "Nota importante" });

    expect(mergeContactFields(keep, discard)).toEqual({ notes: "Nota importante" });
  });
});
