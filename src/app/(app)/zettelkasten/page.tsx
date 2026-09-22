import Link from "next/link";
import { NewPermanentNoteButton } from "@/features/zettelkasten/components/new-permanent-note-button";
import { getZettelkastenTypeIds, listOrphanNotes } from "@/features/zettelkasten/queries";
import { requireOwner } from "@/lib/auth";

export default async function ZettelkastenPage() {
  const { supabase, user } = await requireOwner();

  const typeIds = await getZettelkastenTypeIds(supabase);
  if (!typeIds) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Zettelkasten</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          O pack &quot;PARA, Zettelkasten e GTD&quot; ainda não está instalado. Instale em{" "}
          <Link href="/configuracoes/metodos" className="text-black underline dark:text-zinc-50">
            Configurações → Métodos
          </Link>{" "}
          pra criar notas permanentes e literárias conectadas.
        </p>
      </div>
    );
  }

  const orphans = await listOrphanNotes(supabase, user.id, typeIds);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Zettelkasten</h1>
        <Link href="/espacos" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          Ver todas as notas →
        </Link>
      </div>

      <NewPermanentNoteButton spaceId={null} />

      <section className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Notas sem links ({orphans.length})</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Notas permanentes/literárias que não apontam nem são apontadas por nenhuma outra — boas candidatas pra conectar.</p>
        {orphans.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma nota órfã — tudo conectado.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {orphans.map((note) => (
              <li key={note.id}>
                <Link href={`/itens/${note.id}`} className="text-sm text-black underline dark:text-zinc-50">
                  {note.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
