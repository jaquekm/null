import type { InboxSuggestion } from "@/features/ai/prompts/organize-inbox";

export interface OrganizeInboxOption {
  id: string;
  name: string;
}

const MAX_CONTENT_CHARS = 4000;

/** Mensagem pro Claude (6.8, "Organizar inbox") — um item por chamada, com as opções reais de espaço/tipo pra ele escolher por id. */
export function buildOrganizeInboxUserMessage(item: { title: string; contentText: string }, spaces: OrganizeInboxOption[], types: OrganizeInboxOption[]): string {
  const spacesList = spaces.length > 0 ? spaces.map((s) => `${s.id}="${s.name}"`).join(", ") : "nenhum espaço criado ainda";
  const typesList = types.length > 0 ? types.map((t) => `${t.id}="${t.name}"`).join(", ") : "nenhum tipo criado ainda";

  return [
    `Título atual: ${item.title || "(sem título)"}`,
    `Conteúdo: ${item.contentText.slice(0, MAX_CONTENT_CHARS) || "(vazio)"}`,
    "",
    `Espaços disponíveis: ${spacesList}`,
    `Tipos disponíveis: ${typesList}`,
  ].join("\n");
}

/** Descarta um `spaceId`/`typeId` alucinado (id que não existe na lista de opções) — nunca aplica um id que a IA inventou. */
export function coerceInboxSuggestion(suggestion: InboxSuggestion, spaceIds: Set<string>, typeIds: Set<string>): InboxSuggestion {
  return {
    spaceId: suggestion.spaceId && spaceIds.has(suggestion.spaceId) ? suggestion.spaceId : null,
    typeId: suggestion.typeId && typeIds.has(suggestion.typeId) ? suggestion.typeId : null,
    tags: suggestion.tags,
    title: suggestion.title,
  };
}
