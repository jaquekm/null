import { notFound } from "next/navigation";
import { listActiveSpaces } from "@/features/spaces/queries";
import { DuplicateTypeButton } from "@/features/types/components/duplicate-type-button";
import { FieldList } from "@/features/types/components/field-list";
import { TypeEditorForm } from "@/features/types/components/type-editor-form";
import { getObjectTypeBySlug, listOtherObjectTypes } from "@/features/types/queries";
import { requireOwner } from "@/lib/auth";

export default async function TipoDetailPage(props: PageProps<"/configuracoes/tipos/[slug]">) {
  const { slug } = await props.params;
  const { supabase } = await requireOwner();

  const type = await getObjectTypeBySlug(supabase, slug);
  if (!type) notFound();

  const [spaces, otherTypes] = await Promise.all([listActiveSpaces(supabase), listOtherObjectTypes(supabase, type.id)]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-black dark:text-zinc-50">
            <span>{type.icon || "•"}</span>
            {type.name}
            {type.isSystem && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                Tipo do sistema
              </span>
            )}
          </h1>
        </div>
        <DuplicateTypeButton typeId={type.id} />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Configurações</h2>
        <TypeEditorForm type={type} spaces={spaces} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Campos</h2>
        <FieldList typeId={type.id} fields={type.fields} otherTypes={otherTypes} />
      </section>

      <p className="rounded-lg border border-dashed border-black/[.12] p-4 text-sm text-zinc-500 dark:border-white/[.16] dark:text-zinc-400">
        O template de conteúdo (corpo inicial no editor Tiptap) chega na tarefa 1.7, junto com o editor.
      </p>
    </div>
  );
}
