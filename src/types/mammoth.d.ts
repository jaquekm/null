/**
 * `mammoth` não publica tipos próprios nem tem `@types/mammoth` no
 * DefinitelyTyped — declaração mínima só com o que o projeto usa:
 * `convertToMarkdown` (2.9, extrair texto de `.docx`) e `images.imgElement`
 * (7.5+, origem "Documento" do assistente de importação — descarta imagens
 * embutidas em vez de converter pra base64 gigante dentro do item).
 */
declare module "mammoth" {
  export interface ConversionResult {
    value: string;
    messages: unknown[];
  }

  export interface ConvertToMarkdownOptions {
    convertImage?: (element: unknown, messages: unknown[]) => Promise<unknown[]>;
  }

  export function convertToMarkdown(input: { buffer: Buffer }, options?: ConvertToMarkdownOptions): Promise<ConversionResult>;

  export const images: {
    imgElement: (fn: (element: unknown) => unknown | Promise<unknown>) => ConvertToMarkdownOptions["convertImage"];
  };
}
