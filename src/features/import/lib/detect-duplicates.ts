export interface ExistingItemForDuplicateCheck {
  id: string;
  title: string;
  createdAt: string;
}

export interface DuplicateCandidate {
  localId: string;
  existingItemId: string;
  existingTitle: string;
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

/**
 * Detecção de duplicados "por título + data" (7.5) — casa pelo título
 * normalizado (sem acento/maiúscula, espaços colapsados); quando o item
 * importado tem data de criação conhecida, só considera duplicata quem
 * também bate a mesma data (dia, não hora exata — fusos/formatos de origem
 * variam demais pra exigir a hora igual); sem data conhecida, cai pra
 * título só (mais falsos positivos, mas melhor que nunca avisar).
 */
export function findDuplicateCandidates(
  parsedItems: { localId: string; title: string; createdAt: string | null }[],
  existingItems: ExistingItemForDuplicateCheck[],
): DuplicateCandidate[] {
  const byTitle = new Map<string, ExistingItemForDuplicateCheck[]>();
  for (const existing of existingItems) {
    const key = normalizeTitle(existing.title);
    const list = byTitle.get(key) ?? [];
    list.push(existing);
    byTitle.set(key, list);
  }

  const matches: DuplicateCandidate[] = [];
  for (const parsed of parsedItems) {
    const candidates = byTitle.get(normalizeTitle(parsed.title));
    if (!candidates || candidates.length === 0) continue;

    const match = parsed.createdAt ? candidates.find((c) => sameDay(c.createdAt, parsed.createdAt!)) : candidates[0];
    if (match) matches.push({ localId: parsed.localId, existingItemId: match.id, existingTitle: match.title });
  }
  return matches;
}
