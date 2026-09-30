"use client";

import { Download, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * QR code do link (9.7) — pra imprimir numa lista, colar num convite ou
 * mostrar na tela pra alguém apontar a câmera. Gerado no navegador (mesma
 * biblioteca do QR do Pix); "Baixar" salva um PNG.
 */
export function ShareQrCode({ url, fileName = "link-jkode", className }: { url: string; fileName?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || dataUrl) return;
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 2, width: 480, errorCorrectionLevel: "M" })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, url, dataUrl]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <QrCode className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden />
        QR code
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-white p-4 text-zinc-700 shadow-sm">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL gerada aqui, sem otimização de imagem a fazer.
        <img src={dataUrl} alt="QR code do link" width={220} height={220} className="h-56 w-56" />
      ) : (
        <div className="h-56 w-56 animate-pulse rounded-lg bg-zinc-100" aria-label="Gerando QR code" />
      )}
      <p className="text-center text-xs text-zinc-500">Aponte a câmera do celular pra abrir o link.</p>
      {dataUrl && (
        <a href={dataUrl} download={`${fileName}.png`} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline">
          <Download className="h-4 w-4" aria-hidden /> Baixar QR code
        </a>
      )}
    </div>
  );
}
