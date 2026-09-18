import { CaptureForm } from "@/features/capture/components/capture-form";
import { listObjectTypesForPicker } from "@/features/items/queries";
import { listActiveSpaces } from "@/features/spaces/queries";
import { requireOwner } from "@/lib/auth";

/**
 * Versão tela cheia da captura (1.10) — atalho na tela inicial do celular,
 * alvo do bookmarklet e do `share_target` da PWA (1.12).
 */
export default async function CapturarPage(props: PageProps<"/capturar">) {
  const { supabase } = await requireOwner();
  const searchParams = await props.searchParams;

  const [spaces, types] = await Promise.all([listActiveSpaces(supabase), listObjectTypesForPicker(supabase)]);

  const title = typeof searchParams.title === "string" ? searchParams.title : "";
  const text = typeof searchParams.text === "string" ? searchParams.text : "";
  const url = typeof searchParams.url === "string" ? searchParams.url : "";
  const initialText = [title, text, url].filter(Boolean).join("\n");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Capturar</h1>
      <CaptureForm spaces={spaces} types={types} initialText={initialText} redirectOnSave />
    </div>
  );
}
