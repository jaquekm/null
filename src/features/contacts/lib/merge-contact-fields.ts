export interface MergeableContact {
  nickname: string | null;
  company: string | null;
  role: string | null;
  phone_e164: string | null;
  email: string | null;
  birthday: string | null;
  address: Record<string, unknown> | null;
  notes: string | null;
  avatar_path: string | null;
  space_id: string | null;
}

/**
 * "Mesclar dois contatos... mantém o mais completo" (3.3): o dono escolhe
 * qual dos dois fica (`keep`); esta função só preenche os campos vazios do
 * que fica com o valor do que vai ser descartado (`discard`) — nunca
 * sobrescreve um campo que `keep` já tinha preenchido.
 */
export function mergeContactFields(keep: MergeableContact, discard: MergeableContact): Partial<MergeableContact> {
  const merged: Partial<MergeableContact> = {};
  const keys = Object.keys(keep) as (keyof MergeableContact)[];

  for (const key of keys) {
    const keepValue = keep[key];
    const isEmpty = keepValue === null || keepValue === "";
    if (isEmpty && discard[key] !== null && discard[key] !== "") {
      merged[key] = discard[key] as never;
    }
  }

  return merged;
}
