/**
 * Slug simples: minúsculo, sem acentos, só `[a-z0-9-]`, sem hífen nas pontas
 * nem duplicado. Usado para `spaces.slug`, `object_types.slug` etc.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
