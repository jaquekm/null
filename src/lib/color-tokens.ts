/**
 * Paleta categórica única do Hub — usada para diferenciar tags, espaços e
 * tipos de objeto visualmente ("achar as coisas pela cor"). Fonte única de
 * verdade: antes disso `COLOR_TOKENS` estava duplicado (e sem uso real das
 * classes) em `tag-management-list.tsx` e `onboarding-form.tsx`.
 *
 * O valor salvo no banco é sempre um destes tokens (texto livre na coluna,
 * mas só estes nomes têm classe — qualquer outra coisa cai no fallback
 * neutro). Classes do Tailwind ficam por extenso nos mapas abaixo (nunca
 * `bg-${token}-500`) porque o scanner do Tailwind não resolve interpolação.
 */

export const COLOR_TOKENS = ["slate", "red", "amber", "emerald", "teal", "sky", "blue", "violet", "rose"] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

const COLOR_LABELS: Record<ColorToken, string> = {
  slate: "Cinza",
  red: "Vermelho",
  amber: "Âmbar",
  emerald: "Verde",
  teal: "Turquesa",
  sky: "Azul-claro",
  blue: "Azul",
  violet: "Violeta",
  rose: "Rosa",
};

const DOT_CLASSES: Record<ColorToken, string> = {
  slate: "bg-slate-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
};

const BADGE_CLASSES: Record<ColorToken, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const FALLBACK_DOT = "bg-zinc-400 dark:bg-zinc-600";
const FALLBACK_BADGE = "bg-black/[.06] text-zinc-700 dark:bg-white/[.1] dark:text-zinc-200";

export function isColorToken(value: string | null | undefined): value is ColorToken {
  return value != null && (COLOR_TOKENS as readonly string[]).includes(value);
}

/** Nome em português pra usar em `aria-label`/tooltip do seletor de cor. */
export function colorLabel(token: string | null | undefined): string {
  return isColorToken(token) ? COLOR_LABELS[token] : "Sem cor";
}

/** Classe do "pontinho" sólido (sidebar de espaços, indicador de tipo). */
export function colorDotClassName(token: string | null | undefined): string {
  return isColorToken(token) ? DOT_CLASSES[token] : FALLBACK_DOT;
}

/** Classes de fundo/texto do badge (tags, pills). */
export function colorBadgeClassName(token: string | null | undefined): string {
  return isColorToken(token) ? BADGE_CLASSES[token] : FALLBACK_BADGE;
}
