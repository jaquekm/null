import { describe, expect, it } from "vitest";
import { parseVCard } from "./parse-vcard";

describe("parseVCard", () => {
  it("extrai um contato simples com FN, TEL, EMAIL", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:João da Silva",
      "TEL;TYPE=CELL:+55 11 98765-4321",
      "EMAIL;TYPE=INTERNET:joao@example.com",
      "END:VCARD",
    ].join("\r\n");

    const contacts = parseVCard(vcf);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      name: "João da Silva",
      phones: ["+55 11 98765-4321"],
      emails: ["joao@example.com"],
    });
  });

  it("monta o nome a partir de N quando não há FN", () => {
    const vcf = ["BEGIN:VCARD", "VERSION:3.0", "N:Silva;Maria;;;", "END:VCARD"].join("\n");
    const contacts = parseVCard(vcf);
    expect(contacts[0]?.name).toBe("Maria Silva");
  });

  it("extrai ORG, TITLE, BDAY e NOTE", () => {
    const vcf = [
      "BEGIN:VCARD",
      "FN:Ana Souza",
      "ORG:Acme Corp;Vendas",
      "TITLE:Gerente",
      "BDAY:19900115",
      "NOTE:Cliente desde 2020",
      "END:VCARD",
    ].join("\n");
    const contacts = parseVCard(vcf);
    expect(contacts[0]).toMatchObject({
      company: "Acme Corp",
      role: "Gerente",
      birthday: "1990-01-15",
      notes: "Cliente desde 2020",
    });
  });

  it("processa múltiplos contatos no mesmo arquivo", () => {
    const vcf = [
      "BEGIN:VCARD",
      "FN:Contato Um",
      "END:VCARD",
      "BEGIN:VCARD",
      "FN:Contato Dois",
      "END:VCARD",
    ].join("\n");
    const contacts = parseVCard(vcf);
    expect(contacts.map((c) => c.name)).toEqual(["Contato Um", "Contato Dois"]);
  });

  it("junta linhas continuadas (dobradas com espaço no início)", () => {
    const vcf = ["BEGIN:VCARD", "NOTE:Uma nota bem longa que\r\n  continua na próxima linha", "FN:X", "END:VCARD"].join(
      "\r\n",
    );
    const contacts = parseVCard(vcf);
    expect(contacts[0]?.notes).toBe("Uma nota bem longa que continua na próxima linha");
  });

  it("ignora um VCARD sem nenhum nome (FN nem N)", () => {
    const vcf = ["BEGIN:VCARD", "TEL:123456", "END:VCARD"].join("\n");
    expect(parseVCard(vcf)).toHaveLength(0);
  });

  it("aceita múltiplos telefones e e-mails no mesmo contato", () => {
    const vcf = [
      "BEGIN:VCARD",
      "FN:Multi Contato",
      "TEL;TYPE=CELL:11111111",
      "TEL;TYPE=HOME:22222222",
      "EMAIL:um@example.com",
      "EMAIL:dois@example.com",
      "END:VCARD",
    ].join("\n");
    const contacts = parseVCard(vcf);
    expect(contacts[0]?.phones).toEqual(["11111111", "22222222"]);
    expect(contacts[0]?.emails).toEqual(["um@example.com", "dois@example.com"]);
  });
});
