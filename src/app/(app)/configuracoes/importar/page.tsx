import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";
import { ImportWizard } from "@/features/import/components/import-wizard";

/** `/configuracoes/importar` (7.5): assistente de importação por origem (Evernote, Obsidian, Google Keep, calendário .ics). */
export default async function ImportPage() {
  const { supabase } = await requireOwner();
  const spaces = await listActiveSpaces(supabase);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Importar</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Traga suas notas de outro app pra cá. Todo passo tem pré-visualização antes de gravar qualquer
          coisa, e toda importação pode ser desfeita logo depois (itens não editados desde então voltam pra
          lixeira).
        </p>
      </div>

      <ImportWizard spaces={spaces} />
    </div>
  );
}
