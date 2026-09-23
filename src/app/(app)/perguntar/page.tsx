import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { AskWorkspace } from "@/features/ai/components/ask-workspace";
import { listConversations } from "@/features/ai/queries";
import { isFinanceAiEnabled } from "@/features/financas/queries";
import { listObjectTypesForPicker } from "@/features/items/queries";
import { isAiModuleEnabled } from "@/features/settings/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

export default async function PerguntarPage() {
  const { supabase, user } = await requireOwner();

  const aiEnabled = await isAiModuleEnabled(supabase, user.id);
  if (!aiEnabled) {
    return <PlaceholderPage title="Pergunte à sua base" description="O módulo de IA está desligado. Ative em Configurações → IA pra usar o chat." />;
  }

  const [conversations, spaces, types, financeAiEnabled] = await Promise.all([
    listConversations(supabase, user.id),
    listActiveSpaces(supabase),
    listObjectTypesForPicker(supabase),
    isFinanceAiEnabled(supabase, user.id),
  ]);

  return <AskWorkspace conversations={conversations} spaces={spaces} types={types} financeAiEnabled={financeAiEnabled} />;
}
