/**
 * Ditado na captura (9.9): o navegador transcreve a fala (Web Speech API,
 * `pt-BR`) direto no campo de texto — instantâneo, sem mandar áudio pro
 * servidor. Onde não existe (Firefox, alguns modos de app instalado no
 * iPhone), a captura continua com "Gravar nota de voz", que transcreve no
 * servidor (2.5/2.6).
 */

/** Pontuação falada que o ditado do celular não põe sozinho. */
const SPOKEN_PUNCTUATION: [RegExp, string][] = [
  [/\s*\bnova linha\b\s*/gi, "\n"],
  [/\s*\bponto de interroga[cç][aã]o\b/gi, "?"],
  [/\s*\bponto de exclama[cç][aã]o\b/gi, "!"],
  [/\s*\bponto final\b/gi, "."],
  [/\s*\bv[ií]rgula\b/gi, ","],
  [/\s*\bdois pontos\b/gi, ":"],
];

export function applySpokenPunctuation(text: string): string {
  let result = text;
  for (const [pattern, replacement] of SPOKEN_PUNCTUATION) result = result.replace(pattern, replacement);
  // Depois de pontuação vem espaço (menos no fim e antes de quebra de linha).
  return result.replace(/([,.!?:])(?=[^\s\n])/g, "$1 ").replace(/[ \t]+\n/g, "\n");
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

/**
 * Junta um trecho ditado ao que já está no campo: começa com maiúscula no
 * início, depois de quebra de linha ou de fim de frase; senão só um espaço.
 */
export function joinDictation(base: string, spoken: string): string {
  const piece = applySpokenPunctuation(spoken.trim());
  if (!piece) return base;
  if (!base.trim()) return capitalize(piece);
  if (base.endsWith("\n")) return base + capitalize(piece.replace(/^\n+/, ""));
  if (/[.!?]\s*$/.test(base)) return `${base.replace(/\s*$/, "")} ${capitalize(piece)}`;
  if (piece.startsWith("\n") || /^[,.!?:]/.test(piece)) return base.replace(/\s+$/, "") + piece;
  return `${base.replace(/\s+$/, "")} ${piece}`;
}

/** O que o componente precisa da Web Speech API (tipado aqui porque o TS não traz `SpeechRecognition`). */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(scope: unknown): SpeechRecognitionCtor | null {
  if (!scope || typeof scope !== "object") return null;
  const candidate = (scope as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ?? (scope as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  return typeof candidate === "function" ? (candidate as SpeechRecognitionCtor) : null;
}

/** Mensagem pra cada erro do ditado; `null` = não precisa avisar (ex.: ficou em silêncio). */
export function dictationErrorMessage(error: string): string | null {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Sem permissão pro microfone. Libere nas configurações do navegador.";
    case "audio-capture":
      return "Não achei um microfone.";
    case "network":
      return "O ditado precisa de internet. Use “Gravar nota de voz” ou digite.";
    case "no-speech":
    case "aborted":
      return null;
    default:
      return "O ditado parou. Tente de novo.";
  }
}
