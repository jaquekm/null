export type LogLevel = "info" | "warn" | "error";

/**
 * Log estruturado (7.6): uma linha JSON por evento — pensado pra
 * grep/agregação em qualquer provedor de log (a Vercel já coleta
 * `console.*` como linhas de log da função), não um logger de verdade (sem
 * transporte próprio, sem nível configurável). `fields` nunca deve levar
 * dado sensível (conteúdo de nota, valor financeiro, dado de contato) — é
 * responsabilidade de quem chama, igual ao enunciado pede
 * (`{ level, msg, jobId, kind }`, só identificadores/contadores).
 */
export function logEvent(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
