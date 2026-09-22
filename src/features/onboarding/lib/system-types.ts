import { z } from "zod";
import { fieldDefinitionSchema, type FieldDefinition } from "@/features/types/schemas";

type FieldSeed = z.input<typeof fieldDefinitionSchema>;

function fields(...seeds: FieldSeed[]): FieldDefinition[] {
  return seeds.map((seed) => fieldDefinitionSchema.parse(seed));
}

export interface SystemTypeSeed {
  name: string;
  pluralName: string;
  slug: string;
  icon: string;
  fields: FieldDefinition[];
}

/**
 * Tipos básicos criados no primeiro acesso (`is_system = true`, globais —
 * `space_id = null`), conforme a tarefa 1.3 (docs/fase-01-nucleo.md).
 */
export const SYSTEM_TYPE_SEEDS: SystemTypeSeed[] = [
  {
    name: "Nota",
    pluralName: "Notas",
    slug: "nota",
    icon: "StickyNote",
    fields: [],
  },
  {
    name: "Tarefa",
    pluralName: "Tarefas",
    slug: "tarefa",
    icon: "CheckSquare",
    fields: fields(
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { id: "todo", label: "A fazer" },
          { id: "doing", label: "Fazendo" },
          { id: "done", label: "Feito" },
        ],
      },
      { key: "prazo", label: "Prazo", type: "date" },
      {
        key: "prioridade",
        label: "Prioridade",
        type: "select",
        options: [
          { id: "baixa", label: "Baixa" },
          { id: "media", label: "Média" },
          { id: "alta", label: "Alta" },
        ],
      },
    ),
  },
  {
    name: "Documento",
    pluralName: "Documentos",
    slug: "documento",
    icon: "FileText",
    fields: fields(
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { id: "rascunho", label: "Rascunho" },
          { id: "revisao", label: "Em revisão" },
          { id: "publicado", label: "Publicado" },
        ],
      },
      { key: "revisar_em", label: "Revisar em", type: "date" },
    ),
  },
  {
    name: "Referência",
    pluralName: "Referências",
    slug: "referencia",
    icon: "BookMarked",
    fields: fields(
      { key: "url", label: "URL", type: "url" },
      { key: "autor", label: "Autor", type: "text" },
      { key: "lida", label: "Lida", type: "checkbox" },
    ),
  },
  {
    name: "Ideia",
    pluralName: "Ideias",
    slug: "ideia",
    icon: "Lightbulb",
    fields: fields({
      key: "potencial",
      label: "Potencial",
      type: "rating",
      min: 1,
      max: 5,
    }),
  },
  {
    name: "Reunião",
    pluralName: "Reuniões",
    slug: "reuniao",
    icon: "Users",
    fields: fields(
      { key: "data", label: "Data", type: "datetime" },
      { key: "participantes", label: "Participantes", type: "contact" },
    ),
  },
  {
    name: "Canvas",
    pluralName: "Canvas",
    slug: "canvas",
    icon: "🗺️",
    fields: [],
  },
];
