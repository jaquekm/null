import { sanitizeFileName } from "./sanitize-filename";

/**
 * Caminho do Storage para um anexo (1.9): `{owner_id}/{item_id}/{uuid}-{nome-sanitizado}`.
 * `itemId` nulo (anexo avulso, sem item — 4.8, boleto de conta a pagar) vira
 * `avulso`, exatamente como o comentário da coluna `storage_path` da
 * migration da fundação já previa. As policies do bucket (`storage.objects`)
 * só checam o primeiro segmento (`owner_id`), então este segundo segmento é
 * só organização — não precisa de migration nem policy nova.
 */
export function buildStoragePath(ownerId: string, itemId: string | null, uuid: string, fileName: string): string {
  return `${ownerId}/${itemId ?? "avulso"}/${uuid}-${sanitizeFileName(fileName)}`;
}
