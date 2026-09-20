import { cookies, headers } from "next/headers";
import { listItemAttachments } from "@/features/attachments/queries";
import { PasswordGate } from "@/features/sharing/components/password-gate";
import { SharePageContent } from "@/features/sharing/components/share-page-content";
import { getRequestIp } from "@/features/sharing/lib/get-request-ip";
import { isShareLinkActive } from "@/features/sharing/lib/is-share-link-active";
import { createRateLimiter } from "@/features/sharing/lib/rate-limit";
import { registerShareLinkView } from "@/features/sharing/lib/register-share-link-view";
import { shareAuthCookieName, verifyShareAuthCookie } from "@/features/sharing/lib/share-auth-cookie";
import { hashShareToken } from "@/features/sharing/lib/share-token";
import { findShareLinkByTokenHash, getPublicItemResource } from "@/features/sharing/queries";
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

export default async function SharePage(props: PageProps<"/p/[token]">) {
  const { token } = await props.params;
  const admin = createAdminClient();

  const ip = await getRequestIp();
  if (checkPageRateLimit(ip)) return <InvalidLinkMessage />;

  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || !isShareLinkActive(shareLink) || shareLink.resourceType !== "item") {
    return <InvalidLinkMessage />;
  }

  if (shareLink.passwordHash) {
    const cookieStore = await cookies();
    const authenticated = verifyShareAuthCookie(shareLink.id, cookieStore.get(shareAuthCookieName(shareLink.id))?.value);
    if (!authenticated) return <PasswordGate token={token} />;
  }

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
