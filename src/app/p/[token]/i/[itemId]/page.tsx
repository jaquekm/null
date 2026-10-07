import { ArrowLeft } from "lucide-react";
import { PasswordGate } from "@/features/sharing/components/password-gate";
import { SharedListEditor } from "@/features/sharing/components/shared-list-editor";
import { listEntries } from "@/features/items/lib/list-styles";
import { editableListStyle } from "@/features/sharing/lib/editable-list";
import { SharePageContent } from "@/features/sharing/components/share-page-content";
import { getRequestIp } from "@/features/sharing/lib/get-request-ip";
import { isShareLinkActive } from "@/features/sharing/lib/is-share-link-active";
import { createRateLimiter } from "@/features/sharing/lib/rate-limit";
import { isShareLinkUnlocked } from "@/features/sharing/lib/share-auth-cookie";
import { hashShareToken } from "@/features/sharing/lib/share-token";
import { findShareLinkByTokenHash, getPublicSpaceItem } from "@/features/sharing/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const checkPageRateLimit = createRateLimiter(120, 60 * 1000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function InvalidLinkMessage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 p-10 text-center">
      <h1 className="text-lg font-medium text-black dark:text-zinc-50">Link inválido ou expirado</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Peça pra quem compartilhou enviar um link novo.</p>
    </div>
  );
}

/**
 * Um item dentro de um espaço compartilhado (9.7). Mesmas checagens da
 * página do link (limite de acessos, validade, senha) e o item precisa
 * estar no espaço — e na subcategoria — do link. Sempre só leitura.
 */
export default async function SharedSpaceItemPage(props: PageProps<"/p/[token]/i/[itemId]">) {
  const { token, itemId } = await props.params;
  if (!UUID.test(itemId)) return <InvalidLinkMessage />;
  const admin = createAdminClient();

  const ip = await getRequestIp();
  if (checkPageRateLimit(ip)) return <InvalidLinkMessage />;

  const shareLink = await findShareLinkByTokenHash(admin, hashShareToken(token));
  if (!shareLink || shareLink.resourceType !== "space" || !isShareLinkActive(shareLink)) return <InvalidLinkMessage />;
  if (!(await isShareLinkUnlocked(shareLink))) return <PasswordGate token={token} />;

  const item = await getPublicSpaceItem(admin, shareLink.ownerId, shareLink.resourceId, shareLink.tagId, itemId);
  if (!item) return <InvalidLinkMessage />;

  // Link de edição de espaço (07/10): cada lista do espaço abre editável, com o nome de quem mexeu.
  const listStyle = shareLink.permission === "edit" && shareLink.label?.trim() ? editableListStyle(item.typeSlug, item.properties) : null;

  return (
    <div className="flex flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
        <a href={`/p/${token}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-brand-text dark:text-zinc-400">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar à lista
        </a>
      </div>
      {listStyle ? (
        <SharedListEditor
          token={token}
          itemId={itemId}
          title={item.title}
          style={listStyle}
          viewerName={shareLink.label!.trim()}
          entries={listEntries(item.content).map((entry) => ({
            index: entry.index,
            text: entry.text,
            checked: entry.checked,
            score: entry.score,
            details: entry.details,
            author: entry.author,
            scoreBy: entry.scoreBy,
            mine: entry.authorLink === shareLink.id,
          }))}
        />
      ) : (
        <SharePageContent token={token} permission="view" title={item.title} content={item.content} fields={item.fields} properties={item.properties} attachments={[]} />
      )}
    </div>
  );
}
