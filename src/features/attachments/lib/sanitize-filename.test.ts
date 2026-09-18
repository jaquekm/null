import { describe, expect, it } from "vitest";
import { sanitizeFileName } from "./sanitize-filename";

describe("sanitizeFileName", () => {
  it("mantém a extensão em minúsculo", () => {
    expect(sanitizeFileName("Relatório Final.PDF")).toBe("relatorio-final.pdf");
  });

  it("remove acentos e espaços do nome", () => {
    expect(sanitizeFileName("Foto de férias 2026.jpg")).toBe("foto-de-ferias-2026.jpg");
  });

  it("lida com nome sem extensão", () => {
    expect(sanitizeFileName("README")).toBe("readme");
  });

  it("lida com arquivo oculto (ponto no início) sem tratar como extensão", () => {
    expect(sanitizeFileName(".env")).toBe("env");
  });

  it("usa 'arquivo' como base quando o nome não sobra nada após sanitizar", () => {
    expect(sanitizeFileName("###.png")).toBe("arquivo.png");
  });
});
