import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ZipArchive } from "archiver";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { buildContactsCsv } from "./build-contacts";
import { buildItemMarkdown, itemFileSlug } from "./build-item-markdown";

/**
 * Estrutura do `.zip` de exportação (7.11) — mesma mecânica de `export-all.ts`
 * (`ZipArchive` escrevendo num arquivo temporário, `archive.append` por
 * entrada, `finalize`), mas isolada dos ~15 consultas ao Supabase do job de
 * verdade: monta um zip pequeno com as mesmas funções puras (`buildItemMarkdown`,
 * `buildContactsCsv`) e reabre com `jszip` pra conferir que as entradas têm
 * o caminho certo e o conteúdo exato (BOM incluso) sobrevive.
 */
describe("estrutura do zip de exportação", () => {
  let tmpDir: string | undefined;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  });

  it("cada entrada aparece no caminho esperado, com o conteúdo exato do builder", async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "hub-export-test-"));
    const zipPath = path.join(tmpDir, "export.zip");

    const itemMarkdown = buildItemMarkdown({
      id: "11111111-1111-1111-1111-111111111111",
      title: "Nota de teste",
      typeName: "Nota",
      spaceName: "Trabalho",
      tags: ["exemplo"],
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      propertyLines: [],
      outgoingLinkTitles: [],
      bodyMarkdown: "Corpo da nota.",
    });
    const itemFileName = itemFileSlug("Nota de teste", "11111111-1111-1111-1111-111111111111");

    const contactsCsv = buildContactsCsv([
      { name: "Maria", nickname: null, relationship: "amiga", company: null, role: null, phoneE164: null, email: null, birthday: null, spaceName: null, notes: null },
    ]);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = createWriteStream(zipPath);
    const closed = new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
    });
    archive.pipe(output);
    archive.append(itemMarkdown, { name: `hub-export/espacos/trabalho/nota/${itemFileName}` });
    archive.append(contactsCsv, { name: "hub-export/contatos/contatos.csv" });
    await archive.finalize();
    await closed;

    const zipBuffer = await readFile(zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);

    const entryNames = Object.keys(zip.files).sort();
    expect(entryNames).toEqual([`hub-export/contatos/contatos.csv`, `hub-export/espacos/trabalho/nota/${itemFileName}`].sort());

    const readBackMarkdown = await zip.file(`hub-export/espacos/trabalho/nota/${itemFileName}`)!.async("string");
    expect(readBackMarkdown).toBe(itemMarkdown);
    expect(readBackMarkdown).toContain("titulo: Nota de teste");
    expect(readBackMarkdown).toContain("tags:\n  - exemplo");

    const readBackCsv = await zip.file("hub-export/contatos/contatos.csv")!.async("string");
    expect(readBackCsv).toBe(contactsCsv);
    expect(readBackCsv.charCodeAt(0)).toBe(0xfeff); // BOM preservado dentro do zip
    expect(readBackCsv).toContain(";");
  });
});
