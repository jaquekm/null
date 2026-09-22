import { formatBRL } from "@/lib/money";
import { CopyPixCodeButton } from "./copy-pix-code-button";

/** QR Code Pix + copia e cola + chave/nome pra conferência manual (4.10). */
export function PixPaymentBlock({
  qrDataUrl,
  payload,
  amountCents,
  pixKeyLabel,
  merchantName,
}: {
  qrDataUrl: string;
  payload: string;
  amountCents: number;
  pixKeyLabel: string;
  merchantName: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-black/[.08] p-4 text-center dark:border-white/[.08]">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Pagar com Pix</h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, next/image não ajuda aqui */}
      <img src={qrDataUrl} alt="QR Code Pix" className="h-48 w-48" width={192} height={192} />
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{formatBRL(amountCents)}</p>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        <p>{merchantName}</p>
        <p>Chave: {pixKeyLabel}</p>
      </div>
      <CopyPixCodeButton payload={payload} />
      <p className="text-xs text-zinc-400 dark:text-zinc-500">Confira a chave e o nome do recebedor no seu app antes de pagar.</p>
    </div>
  );
}
