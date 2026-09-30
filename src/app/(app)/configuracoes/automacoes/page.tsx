import Link from "next/link";
import { AutomationList } from "@/features/automations/components/automation-list";
import { RecipeList } from "@/features/automations/components/recipe-list";
import { getRecipesOverview, listAutomations } from "@/features/automations/queries";
import { requireOwner } from "@/lib/auth";

export default async function AutomacoesPage() {
  const { supabase, user } = await requireOwner();
  const [automations, recipes] = await Promise.all([listAutomations(supabase, user.id), getRecipesOverview(supabase, user.id)]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Automações</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Quando algo acontecer, o JKode faz sozinho — escrito do jeito que se fala.</p>
      </div>

      <section aria-labelledby="receitas" className="flex flex-col gap-3">
        <div>
          <h2 id="receitas" className="text-base font-semibold text-black dark:text-zinc-50">
            Receitas prontas
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ligue com um toque. Dá pra desligar quando quiser.</p>
        </div>
        <RecipeList states={recipes.states} ownerWhatsapp={recipes.ownerWhatsapp} />
      </section>

      <section aria-labelledby="suas-automacoes" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="suas-automacoes" className="text-base font-semibold text-black dark:text-zinc-50">
            Suas automações
          </h2>
          <Link href="/configuracoes/automacoes/novo" className="bg-brand text-brand-fg rounded-full px-4 py-2 text-sm font-medium">
            Nova automação
          </Link>
        </div>
        <AutomationList automations={automations} />
      </section>
    </div>
  );
}
