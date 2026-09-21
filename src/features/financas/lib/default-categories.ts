export type CategoryKind = "income" | "expense";

export interface DefaultCategoryGroup {
  name: string;
  kind: CategoryKind;
  children: string[];
}

/** Categorias padrão do onboarding financeiro (4.2/4.3, editáveis depois). */
export const DEFAULT_CATEGORIES: DefaultCategoryGroup[] = [
  { name: "Moradia", kind: "expense", children: ["Aluguel", "Condomínio", "Energia", "Água", "Internet"] },
  { name: "Alimentação", kind: "expense", children: ["Mercado", "Restaurantes", "Delivery"] },
  { name: "Transporte", kind: "expense", children: ["Combustível", "App de transporte", "Manutenção"] },
  { name: "Saúde", kind: "expense", children: ["Plano", "Farmácia", "Consultas"] },
  { name: "Educação", kind: "expense", children: [] },
  { name: "Lazer", kind: "expense", children: [] },
  { name: "Assinaturas", kind: "expense", children: [] },
  { name: "Compras", kind: "expense", children: [] },
  { name: "Impostos e taxas", kind: "expense", children: [] },
  { name: "Presentes", kind: "expense", children: [] },
  { name: "Pets", kind: "expense", children: [] },
  { name: "Empresa", kind: "expense", children: ["Ferramentas", "Serviços", "Marketing"] },
  { name: "Outros", kind: "expense", children: [] },
  { name: "Salário/Pró-labore", kind: "income", children: [] },
  { name: "Vendas/Serviços", kind: "income", children: [] },
  { name: "Reembolsos", kind: "income", children: [] },
  { name: "Rendimentos", kind: "income", children: [] },
  { name: "Outros", kind: "income", children: [] },
];

export interface ExistingCategory {
  id: string;
  parentId: string | null;
  name: string;
  kind: CategoryKind;
}

/**
 * Categorias de topo (`parent_id is null`) que ainda faltam pro dono.
 * Não dá pra confiar num `upsert`/`on conflict (owner_id, parent_id, name)`
 * pra isso: com `parent_id` nulo o Postgres nunca considera duas linhas
 * "iguais" (`NULL` não é igual a `NULL` numa constraint única), então rodar
 * a seed de novo criaria duplicata em vez de não fazer nada — por isso a
 * checagem é feita aqui, comparando o que já existe.
 */
export function computeMissingTopCategories(
  existing: ExistingCategory[],
  defaults: DefaultCategoryGroup[] = DEFAULT_CATEGORIES,
): { name: string; kind: CategoryKind }[] {
  const have = new Set(existing.filter((c) => c.parentId === null).map((c) => `${c.kind}:${c.name}`));
  return defaults.filter((group) => !have.has(`${group.kind}:${group.name}`)).map((group) => ({ name: group.name, kind: group.kind }));
}

/** Idem, pras categorias filhas — precisa do id real das categorias de topo (`topIdByKey`, chave `"kind:name"`). */
export function computeMissingChildCategories(
  existing: ExistingCategory[],
  topIdByKey: Map<string, string>,
  defaults: DefaultCategoryGroup[] = DEFAULT_CATEGORIES,
): { parentId: string; name: string; kind: CategoryKind }[] {
  const haveChildren = new Set(existing.filter((c) => c.parentId !== null).map((c) => `${c.parentId}:${c.name}`));

  const rows: { parentId: string; name: string; kind: CategoryKind }[] = [];
  for (const group of defaults) {
    const parentId = topIdByKey.get(`${group.kind}:${group.name}`);
    if (!parentId) continue;
    for (const childName of group.children) {
      if (haveChildren.has(`${parentId}:${childName}`)) continue;
      rows.push({ parentId, name: childName, kind: group.kind });
    }
  }
  return rows;
}
