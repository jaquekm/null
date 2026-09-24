const MAX_DIMENSION = 480;
const THUMBNAIL_QUALITY = 0.8;

/**
 * Redimensiona uma imagem no navegador antes do upload (7.9) — miniatura de
 * até 480px no maior lado, sempre `.jpg` (menor que preservar o formato
 * original pra este uso). Roda só pra `mime_type` de imagem; `null` em
 * qualquer falha (formato que o navegador não decodifica, `canvas` tainted
 * etc.) — a miniatura é um extra, nunca deve travar o upload do arquivo
 * original.
 */
export async function generateThumbnail(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", THUMBNAIL_QUALITY);
    });
  } catch {
    return null;
  }
}
