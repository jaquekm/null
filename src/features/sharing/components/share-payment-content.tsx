import { formatBRL } from "@/lib/money";
import { ClaimPaidButton } from "./claim-paid-button";
import { PixPaymentBlock } from "./pix-payment-block";

export interface SharePaymentPixInfo {
  qrDataUrl: string;
  payload: string;
  pixKeyLabel: string;
  merchantName: string;
}

/**
 * Corpo da página pública `/p/[token]` (4.10) pra `split`/`bill` — mostra
 * título, valor (total + a parte de quem abriu o link, se for divisão),
 * status, Pix e "Já paguei". Reaproveita a estrutura de `SharePageContent`
 * (3.11), mas o conteúdo é bem diferente (sem editor/checklist).
 */
export function SharePaymentContent({
  token,
  title,
  subtitle,
  totalCents,
  outstandingCents,
  statusLabel,
  claimedPaidAt,
  permission,
  hasAttachment,
  fullSplit,
  pix,
}: {
  token: string;
  title: string;
  subtitle: string;
  totalCents?: number;
  outstandingCents: number;
  statusLabel: string;
  claimedPaidAt: string | null;
  permission: string;
  hasAttachment: boolean;
  fullSplit?: { participantName: string; shareCents: number; settledCents: number }[] | null;
  pix: SharePaymentPixInfo | null;
}) {
  const settled = outstandingCents <= 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{title}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
        <div className="flex flex-col">
          <span className="text-2xl font-semibold text-black dark:text-zinc-50">{formatBRL(settled ? (totalCents ?? 0) : outstandingCents)}</span>
          {totalCents != null && totalCents !== outstandingCents && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">Total da divisão: {formatBRL(totalCents)}</span>
          )}
        </div>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{statusLabel}</span>
      </div>

      {fullSplit && fullSplit.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Divisão completa</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {fullSplit.map((p, index) => (
              <li key={index} className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">{p.participantName}</span>
                <span className="text-black dark:text-zinc-50">{formatBRL(p.shareCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasAttachment && (
        <a href={`/p/${token}/receipt`} className="text-sm text-blue-600 underline dark:text-blue-400">
          Ver recibo/anexo
        </a>
      )}

      {settled ? (
        <p className="rounded-lg border border-emerald-600/30 bg-emerald-50 p-3 text-center text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          Tudo certo por aqui — nada a pagar.
        </p>
      ) : (
        <>
          {pix && <PixPaymentBlock qrDataUrl={pix.qrDataUrl} payload={pix.payload} amountCents={outstandingCents} pixKeyLabel={pix.pixKeyLabel} merchantName={pix.merchantName} />}
          {permission === "settle" && <ClaimPaidButton token={token} initiallyClaimed={claimedPaidAt != null} />}
        </>
      )}
    </div>
  );
}
