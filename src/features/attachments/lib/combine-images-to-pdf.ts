import { PDFDocument } from "pdf-lib";

/**
 * Converte uma foto pra JPEG via canvas — usado só quando o formato não é
 * `image/jpeg` nem `image/png` (os dois que o `pdf-lib` sabe incorporar
 * direto), ex.: `image/webp` em alguns navegadores Android.
 */
async function toJpegBytes(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Não foi possível converter a foto.");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * "Combinar em um PDF único" (2.10) — roda no navegador (`pdf-lib`), sem
 * round-trip ao servidor: uma página por foto, na ordem em que foram
 * tiradas/selecionadas, em tamanho real (sem redimensionar).
 */
export async function combineImagesToPdf(files: File[]): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image =
      file.type === "image/png"
        ? await pdfDoc.embedPng(bytes)
        : file.type === "image/jpeg"
          ? await pdfDoc.embedJpg(bytes)
          : await pdfDoc.embedJpg(await toJpegBytes(file));

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}
