import { cookies, headers } from "next/headers";
import QRCode from "qrcode";
import { listItemAttachments } from "@/features/attachments/queries";
import { getDefaultPixKey } from "@/features/financas/queries";
import { BILL_DIRECTION_LABELS, BILL_STATUS_LABELS, SPLIT_STATUS_LABELS, type BillDirection, type BillStatus, type SplitStatus } from "@/features/financas/schemas";
import { buildPixPayload, normalizePixKeyValue } from "@/features/financas/lib/pix";
import { REPORT_KIND_LABELS } from "@/features/reports/schemas";
import { ReportRunView } from "@/features/reports/components/report-run-view";
import { PasswordGate } from "@/features/sharing/components/password-gate";
import { SharePageContent } from "@/features/sharing/components/share-page-content";
import { SharePaymentContent, type SharePaymentPixInfo } from "@/features/sharing/components/share-payment-content";
import { getRequestIp } from "@/features/sharing/lib/get-request-ip";
import { isShareLinkActive } from "@/features/sharing/lib/is-share-link-active";
import { createRateLimiter } from "@/features/sharing/lib/rate-limit";
import { registerShareLinkView } from "@/features/sharing/lib/register-share-link-view";
import { shareAuthCookieName, verifyShareAuthCookie } from "@/features/sharing/lib/share-auth-cookie";
import { hashShareToken } from "@/features/sharing/lib/share-token";
import {
  findShareLinkByTokenHash,
  getPublicBillResource,
  getPublicItemResource,
  getPublicReportRunResource,
  getPublicSplitShareResource,
} from "@/features/sharing/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const checkPageRateLimit = createRateLimiter(60, 60 * 1000);

function InvalidLinkMessage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 p-10 text-center">
      <h1 className="text-lg font-medium text-black dark:text-zinc-50">Link inválido ou expirado</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Peça pra quem compartilhou enviar um link novo.</p>
    </div>
  );
}

/** Monta QR + copia-e-cola do Pix padrão do dono — `null` se não há nada a cobrar ou nenhuma chave cadastrada (4.10). */
async function buildPixInfo(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  outstandingCents: number,
  txidSource: string,
): Promise<SharePaymentPixInfo | null> {
  if (outstandingCents <= 0) return null;

  const pixKey = await getDefaultPixKey(admin, ownerId);
  if (!pixKey) return null;

  const payload = buildPixPayload({
    key: normalizePixKeyValue(pixKey.keyType, pixKey.keyValue),
    merchantName: pixKey.merchantName,
    merchantCity: pixKey.merchantCity,
    amountCents: outstandingCents,
    txid: txidSource.replace(/-/g, ""),
  });
  const qrDataUrl = await QRCode.toDataURL(payload);

  return { qrDataUrl, payload, pixKeyLabel: pixKey.keyValue, merchantName: pixKey.merchantName };
}

export default async function SharePage(props: PageProps<"/p/[token]">) {
  const { token } = await props.params;
  const admin = createAdminClient();

  const ip = await getRequestIp();
  if (checkPageRateLimit(ip)) return <InvalidLinkMessage />;

  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink)) return <InvalidLinkMessage />;

  if (shareLink.passwordHash) {
    const cookieStore = await cookies();
    const authenticated = verifyShareAuthCookie(shareLink.id, cookieStore.get(shareAuthCookieName(shareLink.id))?.value);
    if (!authenticated) return <PasswordGate token={token} />;
  }

  if (shareLink.resourceType === "item") {
    const item = await getPublicItemResource(admin, shareLink.ownerId, shareLink.resourceId);
    if (!item) return <InvalidLinkMessage />;

    const attachments = shareLink.includeAttachments ? await listItemAttachments(admin, shareLink.resourceId) : [];
    const userAgent = (await headers()).get("user-agent");
    await registerShareLinkView(admin, shareLink.ownerId, shareLink.id, ip, userAgent);

    return (
      <SharePageContent
        token={token}
        permission={shareLink.permission}
        title={item.title}
        content={item.content}
        fields={item.fields}
        properties={item.properties}
        attachments={attachments}
      />
    );
  }

  if (shareLink.resourceType === "split") {
    const share = await getPublicSplitShareResource(admin, shareLink.ownerId, shareLink.resourceId, { showFullSplit: shareLink.showFullSplit });
    if (!share) return <InvalidLinkMessage />;

    const outstandingCents = share.shareCents - share.settledCents;
    // Só mostro meu Pix quando fui eu que paguei o total (então essa parte vem pra mim) — se outro contato pagou, o dinheiro nem passa por mim.
    const pix = share.paidByContactId == null ? await buildPixInfo(admin, shareLink.ownerId, outstandingCents, shareLink.resourceId) : null;

    const userAgent = (await headers()).get("user-agent");
    await registerShareLinkView(admin, shareLink.ownerId, shareLink.id, ip, userAgent);

    return (
      <SharePaymentContent
        token={token}
        title={share.splitTitle}
        subtitle={`Divisão de ${share.occurredOn}${share.participantName ? ` · ${share.participantName}` : ""}`}
        totalCents={share.totalCents}
        outstandingCents={outstandingCents}
        statusLabel={SPLIT_STATUS_LABELS[share.status as SplitStatus] ?? share.status}
        claimedPaidAt={share.claimedPaidAt}
        permission={shareLink.permission}
        hasAttachment={shareLink.includeAttachments && share.attachmentId != null}
        fullSplit={share.fullSplit}
        pix={pix}
      />
    );
  }

  if (shareLink.resourceType === "bill") {
    const bill = await getPublicBillResource(admin, shareLink.ownerId, shareLink.resourceId);
    if (!bill) return <InvalidLinkMessage />;

    const outstandingCents = bill.amountCents - bill.paidCents;
    // Idem: só mostro Pix pra conta "a receber" — numa "a pagar" quem deve sou eu, não faz sentido cobrar por esse link.
    const pix = bill.direction === "receivable" ? await buildPixInfo(admin, shareLink.ownerId, outstandingCents, shareLink.resourceId) : null;

    const userAgent = (await headers()).get("user-agent");
    await registerShareLinkView(admin, shareLink.ownerId, shareLink.id, ip, userAgent);

    return (
      <SharePaymentContent
        token={token}
        title={bill.description}
        subtitle={`${BILL_DIRECTION_LABELS[bill.direction as BillDirection] ?? bill.direction} · vence ${bill.dueOn}`}
        outstandingCents={outstandingCents}
        statusLabel={BILL_STATUS_LABELS[bill.status as BillStatus] ?? bill.status}
        claimedPaidAt={bill.claimedPaidAt}
        permission={shareLink.permission}
        hasAttachment={shareLink.includeAttachments && bill.attachmentId != null}
        pix={pix}
      />
    );
  }

  if (shareLink.resourceType === "report") {
    const run = await getPublicReportRunResource(admin, shareLink.ownerId, shareLink.resourceId);
    if (!run) return <InvalidLinkMessage />;

    const userAgent = (await headers()).get("user-agent");
    await registerShareLinkView(admin, shareLink.ownerId, shareLink.id, ip, userAgent);

    const generatedAt = new Date(run.createdAt).toLocaleDateString("pt-BR");
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{REPORT_KIND_LABELS[run.kind]}</p>
          {run.pdfAttachmentId && (
            <a
              href={`/p/${token}/report-pdf`}
              className="rounded-full border border-black/[.12] px-4 py-1.5 text-sm dark:border-white/[.16]"
            >
              Baixar PDF
            </a>
          )}
        </div>
        <ReportRunView kind={run.kind} title={run.title} subtitle={`Gerado em ${generatedAt}`} data={run.data} />
      </div>
    );
  }

  return <InvalidLinkMessage />;
}
