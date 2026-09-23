import { z } from "zod";

export const FILL_PROPERTIES_SYSTEM = [
  "Você extrai valores de campos estruturados a partir do conteúdo de uma nota, em português do Brasil.",
  "Devolva um objeto JSON com uma chave por campo pedido; o valor de cada campo segue exatamente o formato indicado pra ele.",
  "Preencha só os campos cujo valor você tem certeza de encontrar no texto — deixe os outros como null. Nunca invente um valor que não esteja no texto.",
].join("\n");

/** Forma solta de propósito — cada chave é validada/coagida depois, campo a campo, contra o tipo real (`coerceFieldValue`, `lib/fill-properties.ts`). */
export const fillPropertiesResultSchema = z.record(z.string(), z.unknown());

export type FillPropertiesResult = z.infer<typeof fillPropertiesResultSchema>;
