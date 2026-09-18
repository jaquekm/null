import { slugify } from "@/lib/slugify";
import type { SpaceDraft } from "../schemas";

export interface SpaceRow {
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  position: number;
}

/**
 * Converte os rascunhos de espaço do formulário de onboarding em linhas
 * prontas para `upsert` em `spaces` (por `owner_id, slug`): ignora nomes
 * vazios e garante slugs únicos dentro do lote (`-2`, `-3`, ...).
 */
export function buildSpaceRows(drafts: SpaceDraft[]): SpaceRow[] {
  const seenSlugs = new Map<string, number>();
  const rows: SpaceRow[] = [];

  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) continue;

    const base = slugify(name) || `espaco-${rows.length + 1}`;
    const count = seenSlugs.get(base) ?? 0;
    seenSlugs.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count + 1}`;

    rows.push({
      name,
      slug,
      icon: draft.icon?.trim() || null,
      color: draft.color?.trim() || null,
      position: rows.length,
    });
  }

  return rows;
}
