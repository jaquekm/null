"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { createScanItem } from "../actions";
import { combineImagesToPdf } from "../lib/combine-images-to-pdf";
import { uploadAttachment } from "../lib/upload-file";

const buttonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]";

/**
 * "Escanear" (2.10): abre a câmera do celular (`capture="environment"`) pra
 * uma ou várias fotos em sequência, mostra uma prévia em ordem, e cria um
 * item com todas como anexos (extração de texto de cada uma acontece
 * sozinha, pelo mesmo caminho de qualquer upload de imagem, 2.9). O
 * "Combinar em um PDF" é opcional e roda no navegador (`pdf-lib`) — o PDF
 * gerado não passa por OCR automático de novo (o texto de cada foto já foi
 * extraído individualmente; refazer no PDF combinado seria custo de IA em
 * dobro pelo mesmo conteúdo), mas continua com "Extrair novamente" manual
 * disponível se o dono quiser.
 */
export function ScanCapture({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [combinePdf, setCombinePdf] = useState(false);
  const [uploading, setUploading] = useState(false);

  const previewUrls = useMemo(() => (files ? files.map((file) => URL.createObjectURL(file)) : []), [files]);
  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  function handleSelected(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    e.target.value = "";
    if (!list || list.length === 0) return;
    setFiles(Array.from(list));
    setCombinePdf(false);
  }

  function handleCancel() {
    setFiles(null);
  }

  async function handleConfirm() {
    if (!files || files.length === 0 || uploading) return;
    setUploading(true);

    const created = await createScanItem();
    if (!created.ok) {
      toast.error(created.error);
      setUploading(false);
      return;
    }
    const itemId = created.data.id;

    for (const file of files) {
      const result = await uploadAttachment(itemId, file);
      if (!result.ok) toast.error(`Falha ao enviar ${file.name}: ${result.error}`);
    }

    if (combinePdf) {
      try {
        const pdfBlob = await combineImagesToPdf(files);
        const pdfFile = new File([pdfBlob], "documento-escaneado.pdf", { type: "application/pdf" });
        const result = await uploadAttachment(itemId, pdfFile, undefined, undefined, true);
        if (!result.ok) toast.error(`Não foi possível salvar o PDF combinado: ${result.error}`);
      } catch {
        toast.error("Não foi possível combinar as fotos em um PDF.");
      }
    }

    setUploading(false);
    setFiles(null);
    onDone?.();
    toast.success("Documento escaneado.", {
      action: { label: "Abrir", onClick: () => router.push(`/itens/${itemId}`) },
    });
  }

  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} className={buttonClassName}>
        <Camera className="h-4 w-4" />
        Escanear
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleSelected}
      />

      {files && files.length > 0 && (
        <div className="flex w-full flex-col gap-2 rounded-lg border border-black/[.08] p-2.5 text-sm dark:border-white/[.08]">
          <div className="flex flex-wrap gap-2">
            {previewUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local (object URL), não vem de rede
              <img key={url} src={url} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-md object-cover" />
            ))}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {files.length === 1 ? "1 foto" : `${files.length} fotos`}, na ordem em que foram tiradas.
          </p>
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={combinePdf} onChange={(e) => setCombinePdf(e.target.checked)} />
            Combinar em um PDF único
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={uploading} onClick={() => void handleConfirm()} className={buttonClassName}>
              {uploading ? "Enviando..." : "Criar item"}
            </button>
            <button type="button" disabled={uploading} onClick={handleCancel} className={buttonClassName}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
