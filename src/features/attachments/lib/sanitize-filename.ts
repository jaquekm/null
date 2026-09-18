import { slugify } from "@/lib/slugify";

/**
 * Sanitiza um nome de arquivo para uso no caminho do Storage
 * (`{owner_id}/{item_id}/{uuid}-{nome-sanitizado}`, 1.9): preserva a
 * extensão, `slugify` no resto.
 */
export function sanitizeFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < fileName.length - 1;
  const base = hasExtension ? fileName.slice(0, lastDot) : fileName;
  const extension = hasExtension ? fileName.slice(lastDot + 1).toLowerCase() : "";

  const slug = slugify(base) || "arquivo";
  return extension ? `${slug}.${extension}` : slug;
}
