import { TokenManagement } from "@/features/tokens/components/token-management";
import { listApiTokens } from "@/features/tokens/queries";
import { requireOwner } from "@/lib/auth";

export default async function TokensPage() {
  const { supabase } = await requireOwner();
  const tokens = await listApiTokens(supabase);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Tokens de API</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Usados pelo bookmarklet, atalhos e outras automações para chamar a API do Hub. O valor completo só
          aparece uma vez, na hora da criação.
        </p>
      </div>
      <TokenManagement tokens={tokens} />
    </div>
  );
}
