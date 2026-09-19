/**
 * `mammoth` não publica tipos próprios nem tem `@types/mammoth` no
 * DefinitelyTyped — declaração mínima só com o que a 2.9 usa
 * (`convertToMarkdown`, pra extrair texto de `.docx`).
 */
declare module "mammoth" {
  export interface ConversionResult {
    value: string;
    messages: unknown[];
  }

  export function convertToMarkdown(input: { buffer: Buffer }): Promise<ConversionResult>;
}
