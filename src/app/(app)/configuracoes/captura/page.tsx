import { CaptureAutomationSetup } from "@/features/capture/components/capture-automation-setup";
import { listApiTokens } from "@/features/tokens/queries";
import { requireOwner } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export default async function CaptureAutomationPage() {
  const { supabase } = await requireOwner();
  const allTokens = await listApiTokens(supabase);

  const captureTokens = allTokens
    .filter((token) => !token.revokedAt && token.scopes.includes("capture"))
    .map((token) => ({ id: token.id, name: token.name, prefix: token.prefix }));

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Bookmarklet e atalho do iOS</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Formas de capturar sem abrir o Hub primeiro: um favorito do navegador para o computador e um atalho de
          Shortcuts para a folha de compartilhamento do iOS.
        </p>
      </div>
      <CaptureAutomationSetup appUrl={serverEnv.APP_URL} tokens={captureTokens} />
    </div>
  );
}
