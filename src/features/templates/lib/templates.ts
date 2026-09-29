import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import type { ListStyle } from "@/features/items/lib/list-styles";

/**
 * Modelos do "+ Novo" (fase 9.2, pedido da dona): criar pelo que se quer
 * fazer ("Lista de presentes", "Reunião") em vez de escolher um tipo
 * abstrato. Cada modelo já escolhe o tipo, o tipo de lista e um conteúdo
 * inicial. Só aparece o modelo cujo tipo existe pra dona.
 */
export interface ItemTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** Tipo do item (`object_types.slug`). */
  typeSlug: string;
  /** Só pra listas — o tipo de lista (Riscar, Marcar vários…). */
  listStyle?: ListStyle;
  /** Exemplo no campo de nome. */
  titlePlaceholder: string;
  /** Nome quando a dona deixa o campo vazio. */
  defaultTitle: string;
  properties?: Record<string, unknown>;
  content?: JSONContent;
}

const text = (value: string): JSONContent => ({ type: "text", text: value });
const paragraph = (value = ""): JSONContent => ({ type: "paragraph", content: value ? [text(value)] : [] });
const heading = (value: string): JSONContent => ({ type: "heading", attrs: { level: 3 }, content: [text(value)] });
const task = (value = ""): JSONContent => ({ type: "taskItem", attrs: { checked: false }, content: [paragraph(value)] });
const tasks = (...values: string[]): JSONContent => ({ type: "taskList", content: values.map(task) });
const bullets = (...values: string[]): JSONContent => ({
  type: "bulletList",
  content: values.map((value) => ({ type: "listItem", content: [paragraph(value)] })),
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });

export const ITEM_TEMPLATES: ItemTemplate[] = [
  {
    id: "lista-presentes",
    label: "Lista de presentes",
    emoji: "🎁",
    description: "Ideias pra alguém — marque as que gostou mais.",
    typeSlug: "lista",
    listStyle: "multi",
    titlePlaceholder: "Ex.: Presentes pra minha cunhada",
    defaultTitle: "Ideias de presentes",
  },
  {
    id: "lista-compras",
    label: "Lista de compras",
    emoji: "🛒",
    description: "Risque o que já está no carrinho. Dá pra repetir todo mês.",
    typeSlug: "lista",
    listStyle: "checklist",
    titlePlaceholder: "Ex.: Mercado da semana",
    defaultTitle: "Lista de compras",
    properties: { recurring: true },
  },
  {
    id: "checklist-viagem",
    label: "Checklist de viagem",
    emoji: "🧳",
    description: "Documentos, roupas e o que não pode esquecer.",
    typeSlug: "lista",
    listStyle: "checklist",
    titlePlaceholder: "Ex.: Viagem pra praia",
    defaultTitle: "Checklist de viagem",
    content: doc(
      heading("Documentos"),
      tasks("Documento com foto", "Passagens e reservas"),
      heading("Roupas"),
      tasks("Roupas pro número de dias", "Casaco"),
      heading("Não esquecer"),
      tasks("Carregadores", "Remédios"),
    ),
  },
  {
    id: "prioridades",
    label: "Prioridades",
    emoji: "🎯",
    description: "Ordene por importância e separe em grupos.",
    typeSlug: "lista",
    listStyle: "priority",
    titlePlaceholder: "Ex.: Prioridades de vida",
    defaultTitle: "Prioridades",
    content: doc(heading("Saúde"), heading("Família"), heading("Trabalho")),
  },
  {
    id: "avaliar-opcoes",
    label: "Avaliar opções",
    emoji: "⭐",
    description: "Dê nota de 1 a 5 e veja a melhor no topo.",
    typeSlug: "lista",
    listStyle: "rating",
    titlePlaceholder: "Ex.: Destinos de férias",
    defaultTitle: "Opções",
  },
  {
    id: "escolher-um",
    label: "Decidir entre opções",
    emoji: "🤔",
    description: "Liste as opções e marque a escolhida.",
    typeSlug: "lista",
    listStyle: "single",
    titlePlaceholder: "Ex.: Onde jantar sexta",
    defaultTitle: "Decisão",
  },
  {
    id: "reuniao",
    label: "Reunião",
    emoji: "🗓️",
    description: "Pauta, anotações e próximos passos.",
    typeSlug: "reuniao",
    titlePlaceholder: "Ex.: Reunião com fornecedor",
    defaultTitle: "Reunião",
    content: doc(heading("Pauta"), bullets(""), heading("Anotações"), paragraph(), heading("Próximos passos"), tasks("")),
  },
  {
    id: "documento-importante",
    label: "Documento importante",
    emoji: "📄",
    description: "Validade com aviso antes de vencer, número e onde está guardado.",
    typeSlug: "documento",
    titlePlaceholder: "Ex.: Passaporte",
    defaultTitle: "Documento",
    // A validade tem campo próprio (9.5), com aviso 30, 7 e 1 dia antes.
    content: doc(heading("Número"), paragraph(), heading("Onde está guardado"), paragraph()),
  },
  {
    id: "tarefa",
    label: "Tarefa",
    emoji: "✅",
    description: "Algo pra fazer, com prazo e prioridade.",
    typeSlug: "tarefa",
    titlePlaceholder: "Ex.: Renovar o seguro do carro",
    defaultTitle: "Tarefa",
  },
  {
    id: "nota",
    label: "Nota",
    emoji: "📝",
    description: "Texto livre, do jeito que vier.",
    typeSlug: "nota",
    titlePlaceholder: "Ex.: Ideias pro fim de semana",
    defaultTitle: "",
  },
  {
    id: "ideia",
    label: "Ideia",
    emoji: "💡",
    description: "Guarde agora, desenvolva depois.",
    typeSlug: "ideia",
    titlePlaceholder: "Ex.: Curso online de receitas",
    defaultTitle: "Ideia",
  },
];

export const templateIdSchema = z.enum(ITEM_TEMPLATES.map((template) => template.id) as [string, ...string[]]);

export function findTemplate(id: string): ItemTemplate | undefined {
  return ITEM_TEMPLATES.find((template) => template.id === id);
}

/** Só os modelos cujo tipo existe pra dona (um pack não instalado some da lista em vez de dar erro ao criar). */
export function availableTemplates(typeSlugs: Iterable<string>): ItemTemplate[] {
  const slugs = new Set(typeSlugs);
  return ITEM_TEMPLATES.filter((template) => slugs.has(template.typeSlug));
}

/** Propriedades iniciais do item: as do modelo + o tipo de lista. */
export function templateProperties(template: ItemTemplate): Record<string, unknown> {
  return { ...(template.properties ?? {}), ...(template.listStyle ? { list_style: template.listStyle } : {}) };
}

/** Subcategoria digitada → nome de tag (minúsculas, sem espaço sobrando, até 50 caracteres); vazio = sem subcategoria. */
export function normalizeSubcategory(raw: string | undefined | null): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return value ? value.slice(0, 50) : null;
}
