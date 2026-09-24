import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEnex } from "./parse-enex";

const fixturePath = path.join(process.cwd(), "tests/fixtures/import/sample.enex");
const fixture = readFileSync(fixturePath, "utf-8");

describe("parseEnex", () => {
  it("lê as duas notas do fixture, com título, datas, tags", () => {
    const result = parseEnex(fixture);
    expect(result.items).toHaveLength(2);

    const [shopping, meeting] = result.items;
    expect(shopping!.title).toBe("Lista de compras");
    expect(shopping!.tags).toEqual(["casa", "urgente"]);
    expect(shopping!.createdAt).toBe(new Date(Date.UTC(2026, 0, 10, 12, 0, 0)).toISOString());
    expect(shopping!.updatedAt).toBe(new Date(Date.UTC(2026, 0, 11, 9, 0, 0)).toISOString());

    expect(meeting!.title).toBe("Foto da reunião");
    expect(meeting!.updatedAt).toBe(meeting!.createdAt); // sem <updated> no fixture, cai pro created
  });

  it("converte lista e <en-todo> em Markdown", () => {
    const result = parseEnex(fixture);
    const shopping = result.items[0]!;
    expect(shopping.bodyMarkdown).toBe("Comprar:\n- Leite\n- Ovos\n- [x] Pagar a conta de luz");
  });

  it("resource vira attachment e <en-media> vira marcador com o nome do arquivo (casado pelo hash MD5)", () => {
    const result = parseEnex(fixture);
    const meeting = result.items[1]!;
    expect(meeting.attachments).toHaveLength(1);
    expect(meeting.attachments[0]).toMatchObject({ fileName: "foto-reuniao.png", mimeType: "image/png" });
    expect(Buffer.from(meeting.attachments[0]!.data).toString()).toBe("hello");
    expect(meeting.bodyMarkdown).toBe("Segue a **foto**:\n[anexo: foto-reuniao.png]");
  });

  it("arquivo sem nenhuma <note>: sem itens, com aviso", () => {
    const result = parseEnex('<?xml version="1.0"?><en-export></en-export>');
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual(["Nenhuma nota encontrada no arquivo .enex."]);
  });
});
