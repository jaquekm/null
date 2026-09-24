import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { readZipAsText } from "./unzip";

describe("readZipAsText", () => {
  it("lê os arquivos de texto de um zip, ignorando pastas e lixo do macOS", async () => {
    const zip = new JSZip();
    zip.file("nota.md", "# Olá");
    zip.file("pasta/outra.md", "corpo");
    zip.file("__MACOSX/nota.md", "lixo");
    zip.file(".DS_Store", "lixo");
    zip.folder("pasta-vazia");

    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const entries = await readZipAsText(buffer);

    expect(entries.map((e) => e.path).sort()).toEqual(["nota.md", "pasta/outra.md"]);
    expect(entries.find((e) => e.path === "nota.md")!.content).toBe("# Olá");
  });
});
