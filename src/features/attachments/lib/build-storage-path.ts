import { sanitizeFileName } from "./sanitize-filename";

/** Caminho do Storage para um anexo (1.9): `{owner_id}/{item_id}/{uuid}-{nome-sanitizado}`. */
export function buildStoragePath(ownerId: string, itemId: string, uuid: string, fileName: string): string {
  return `${ownerId}/${itemId}/${uuid}-${sanitizeFileName(fileName)}`;
}
