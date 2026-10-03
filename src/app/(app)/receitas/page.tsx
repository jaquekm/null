import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RecipesWorkspace } from "@/features/recipes/components/recipes-workspace";
import { listRecipes } from "@/features/recipes/queries";
import { requireOwner } from "@/lib/auth";

/** Receitas (10.10) — aberta pelo link "Receitas" do cardápio; nome da receita numa célula do cardápio soma os ingredientes na lista de compras. */
export default async function ReceitasPage() {
  const { supabase } = await requireOwner();
  const recipes = await listRecipes(supabase);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <Link href="/cardapio" className="flex items-center gap-0.5 self-start text-sm text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Cardápio
        </Link>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Receitas</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Os ingredientes de cada prato do cardápio. Escreva o mesmo nome no cardápio (maiúscula e acento não importam) e, em “Gerar lista de compras”, os ingredientes somam na sua lista.
        </p>
      </header>
      <RecipesWorkspace recipes={recipes} />
    </div>
  );
}
