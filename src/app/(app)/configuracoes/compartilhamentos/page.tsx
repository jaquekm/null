import { ShareLinksList } from "@/features/sharing/components/share-links-list";
import { listAllShareLinks } from "@/features/sharing/queries";
import { requireOwner } from "@/lib/auth";

export default async function CompartilhamentosPage() {
  const { supabase } = await requireOwner();
  const links = await listAllShareLinks(supabase);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Compartilhamentos</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Todos os links públicos criados, com visualizações, último acesso e revogar.</p>
      </div>
      {links.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum link de compartilhamento criado ainda.</p>
      ) : (
        <ShareLinksList links={links} />
      )}
    </div>
  );
}
