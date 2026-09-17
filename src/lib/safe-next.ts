/**
 * Valida o parâmetro `next` (para onde redirecionar após login) contra
 * open redirect: só aceita um caminho relativo de verdade (começa com uma
 * única barra, não "//..." que o navegador trata como URL absoluta).
 */
export function safeNext(
  next: string | null | undefined,
  fallback = "/inbox",
): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return fallback;
}
