import { describe, expect, it } from "vitest";
import { buildContactVCard, buildContactsCsv, buildContactsVCard, type ContactForExport } from "./build-contacts";

const contact: ContactForExport = {
  name: "Maria Souza",
  nickname: "Mari",
  relationship: "friend",
  company: "Acme, Ltda",
  role: "Diretora",
  phoneE164: "+5511999998888",
  email: "maria@example.com",
  birthday: "1990-05-20",
  spaceName: "Pessoal",
  notes: "Conheceu na faculdade",
};

describe("buildContactsCsv", () => {
  it("monta uma linha por contato", () => {
    const csv = buildContactsCsv([contact]);
    expect(csv).toContain("Nome;Apelido;Relacionamento");
    // vírgula não precisa de aspas: o separador do CSV é `;`, não `,`.
    expect(csv).toContain("Maria Souza;Mari;friend;Acme, Ltda;Diretora");
  });
});

describe("buildContactVCard", () => {
  it("monta um vCard 3.0 com os campos preenchidos", () => {
    const vcard = buildContactVCard(contact);
    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("VERSION:3.0");
    expect(vcard).toContain("FN:Maria Souza");
    expect(vcard).toContain("ORG:Acme\\, Ltda");
    expect(vcard).toContain("TITLE:Diretora");
    expect(vcard).toContain("TEL;TYPE=CELL:+5511999998888");
    expect(vcard).toContain("EMAIL:maria@example.com");
    expect(vcard).toContain("BDAY:19900520");
    expect(vcard).toContain("NOTE:Conheceu na faculdade");
    expect(vcard).toContain("END:VCARD");
  });

  it("omite campos ausentes sem quebrar", () => {
    const minimal: ContactForExport = {
      name: "Só o nome",
      nickname: null,
      relationship: "other",
      company: null,
      role: null,
      phoneE164: null,
      email: null,
      birthday: null,
      spaceName: null,
      notes: null,
    };
    const vcard = buildContactVCard(minimal);
    expect(vcard).toBe("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Só o nome\r\nN:Só o nome;;;;\r\nEND:VCARD");
  });
});

describe("buildContactsVCard", () => {
  it("concatena vários vCards", () => {
    const vcards = buildContactsVCard([contact, { ...contact, name: "Outro" }]);
    expect(vcards.match(/BEGIN:VCARD/g)).toHaveLength(2);
  });
});
