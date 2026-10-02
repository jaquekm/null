"use server";

import { revalidatePath } from "next/cache";
import { completeFinanceOnboarding, seedDefaultCategories } from "@/features/financas/actions";
import { listCategories } from "@/features/financas/queries";
import { installPack } from "@/features/packs/lib/install";
import { listInstalledPacks, listLocalPacks } from "@/features/packs/queries";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { BUNDLES, pendingPacksForBundle, type BundleKey } from "./lib/bundles";

/**
 * "Pacotes prontos" (10.15): instala de uma vez os packs do pacote (e
 * conclui o onboarding de Finanças, se for o caso). Pack já instalado em
 * qualquer espaço é pulado — tocar de novo num pacote já configurado não
 * duplica espaço nem erra.
 */
export async function installBundle(key: BundleKey): Promise<Result<{ redirectHref: string }>> {
  const bundle = BUNDLES.find((b) => b.key === key);
  if (!bundle) return fail("Pacote não encontrado.");
  const { supabase, user } = await requireOwner();

  const installedPackKeys = (await listInstalledPacks(supabase, user.id)).map((row) => row.packKey);
  const pending = pendingPacksForBundle(bundle, installedPackKeys);

  if (pending.length > 0) {
    const localPacks = await listLocalPacks();
    for (const ref of pending) {
      const pack = localPacks.find((entry) => entry.pack?.key === ref.packKey)?.pack;
      if (!pack) continue;
      const installed = await installPack(
        supabase,
        user.id,
        pack,
        ref.spaceName ? { spaceId: null, newSpace: { name: ref.spaceName, icon: pack.icon } } : { spaceId: null },
      );
      if (!installed.ok) return fail(`Não foi possível instalar "${pack.name}". Tente de novo.`);
    }
  }

  if (bundle.completeFinanceOnboarding) {
    const categories = await listCategories(supabase);
    if (categories.length === 0) await seedDefaultCategories();
    await completeFinanceOnboarding();
  }

  revalidatePath("/configuracoes/metodos");
  revalidatePath("/", "layout");
  return ok({ redirectHref: bundle.redirectHref });
}
