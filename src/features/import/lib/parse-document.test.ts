import { beforeEach, describe, expect, it, vi } from "vitest";

const convertToMarkdownMock = vi.fn();
vi.mock("mammoth", () => ({
  default: {
    convertToMarkdown: convertToMarkdownMock,
    images: { imgElement: (fn: () => unknown) => fn },
  },
}));

const { parseDocumentFile, sanitizeMammothMarkdown } = await import("./parse-document");

describe("sanitizeMammothMarkdown", () => {
  it("remove âncoras <a id> que o mammoth insere antes de cada título", () => {
    expect(sanitizeMammothMarkdown('### <a id="_abc123"></a>Título')).toBe("### Título");
  });

  it("converte negrito __texto__ (mammoth) pra **texto** (o que markdownToTiptapDoc entende)", () => {
    expect(sanitizeMammothMarkdown("__negrito__")).toBe("**negrito**");
  });

  it("desfaz o escape de pontuação que o mammoth aplica mesmo quando não precisa", () => {
    expect(sanitizeMammothMarkdown("Dá para confiar\\. Isso é\\-isso\\!")).toBe("Dá para confiar. Isso é-isso!");
  });

  it("preserva uma barra invertida de verdade que existia no texto original", () => {
    expect(sanitizeMammothMarkdown("caminho\\\\do\\\\arquivo")).toBe("caminho\\do\\arquivo");
  });

  it("texto real do mammoth (título em negrito com âncora + pontuação escapada) sai limpo", () => {
    const raw = '### <a id="_3lt8nd1lo46j"></a>__🧠 Pessoal e Filosofia de Vida__\n\n- Vale a pena sacrificar a juventude para ter uma vida confortável na velhice\\.';
    expect(sanitizeMammothMarkdown(raw)).toBe("### **🧠 Pessoal e Filosofia de Vida**\n\n- Vale a pena sacrificar a juventude para ter uma vida confortável na velhice.");
  });
});

describe("parseDocumentFile", () => {
  beforeEach(() => {
    convertToMarkdownMock.mockReset();
  });

  it("um .docx vira um único item, com o título derivado do nome do arquivo", async () => {
    convertToMarkdownMock.mockResolvedValue({ value: "### <a id=\"x\"></a>__Tópico__\n\n- Pergunta um\n- Pergunta dois #ideia", messages: [] });
    const file = new File([new Uint8Array([1, 2, 3])], "temas.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await parseDocumentFile(file);

    expect(result.warnings).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "temas",
      tags: ["ideia"],
      createdAt: null,
      attachments: [],
    });
    expect(result.items[0]!.bodyMarkdown).toBe("### **Tópico**\n\n- Pergunta um\n- Pergunta dois #ideia");
  });

  it("recusa um arquivo que não é .docx", async () => {
    const file = new File(["oi"], "notas.txt", { type: "text/plain" });
    const result = await parseDocumentFile(file);
    expect(result.items).toEqual([]);
    expect(result.warnings[0]).toContain(".docx");
    expect(convertToMarkdownMock).not.toHaveBeenCalled();
  });

  it("documento sem texto (só imagens) não vira item — avisa que veio vazio", async () => {
    convertToMarkdownMock.mockImplementation(async (_input, options) => {
      await options.convertImage({});
      return { value: "   \n\n  ", messages: [] };
    });
    const file = new File([new Uint8Array([1])], "fotos.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await parseDocumentFile(file);

    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual(["1 imagem(ns) do documento não foram importadas — só o texto vira item.", "O documento está vazio."]);
  });

  it("avisa quantas imagens foram descartadas, mas ainda cria o item com o texto", async () => {
    convertToMarkdownMock.mockImplementation(async (_input, options) => {
      await options.convertImage({});
      await options.convertImage({});
      return { value: "Texto do documento.", messages: [] };
    });
    const file = new File([new Uint8Array([1])], "relatorio.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const result = await parseDocumentFile(file);

    expect(result.items).toHaveLength(1);
    expect(result.warnings).toEqual(["2 imagem(ns) do documento não foram importadas — só o texto vira item."]);
  });
});
