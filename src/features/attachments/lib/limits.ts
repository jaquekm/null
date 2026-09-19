/**
 * Extraídas de `actions.ts` (2.2): um arquivo `"use server"` só pode
 * exportar funções assíncronas — essas duas constantes eram plain `const`s
 * lá, o que funcionava por acaso enquanto só um Client Component
 * (`upload-file.ts`) importava só elas, mas quebra o build assim que
 * qualquer outro caminho (ex.: a rota `/api/jobs/tick`, 2.2) puxa o módulo
 * inteiro pra dentro do grafo do servidor.
 */

/** Limite do plano do Supabase (ajuste se o plano do projeto mudar). */
export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;
/** Acima disso o upload usa o protocolo resumível (TUS) em vez do upload padrão. */
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
