export const IMPROVE_TEXT_ACTIONS = ["revisar", "encurtar", "formal", "traduzir"] as const;
export type ImproveTextAction = (typeof IMPROVE_TEXT_ACTIONS)[number];

export const TRANSLATE_LANGUAGES = ["en", "es"] as const;
export type TranslateLanguage = (typeof TRANSLATE_LANGUAGES)[number];

const LANGUAGE_NAMES: Record<TranslateLanguage, string> = { en: "inglês", es: "espanhol" };

const COMMON_INSTRUCTION = "Devolva só o texto resultante — sem comentário, sem aspas em volta, sem cercas de código markdown.";

/**
 * "Melhorar texto" (6.8) — um system prompt por ação, sobre a seleção do
 * editor. `targetLanguage` só é usado (e obrigatório de verdade, ver
 * `improveTextInputSchema`) quando `action === "traduzir"`.
 */
export function buildImproveTextSystem(action: ImproveTextAction, targetLanguage?: TranslateLanguage): string {
  switch (action) {
    case "revisar":
      return `Revise a ortografia e a gramática do texto abaixo, em português do Brasil, sem mudar o sentido nem o tom. ${COMMON_INSTRUCTION}`;
    case "encurtar":
      return `Encurte o texto abaixo, em português do Brasil, mantendo as informações essenciais. ${COMMON_INSTRUCTION}`;
    case "formal":
      return `Reescreva o texto abaixo num tom mais formal, em português do Brasil, sem mudar o sentido. ${COMMON_INSTRUCTION}`;
    case "traduzir":
      return `Traduza o texto abaixo para ${LANGUAGE_NAMES[targetLanguage ?? "en"]}, mantendo o sentido e o tom. ${COMMON_INSTRUCTION}`;
    default: {
      const exhaustive: never = action;
      throw new Error(`Ação desconhecida: ${String(exhaustive)}`);
    }
  }
}
