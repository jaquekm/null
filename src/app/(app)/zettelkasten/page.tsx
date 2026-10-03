import Link from "next/link";
import { NewPermanentNoteButton } from "@/features/zettelkasten/components/new-permanent-note-button";
import { getZettelkastenTypeIds, listOrphanNotes } from "@/features/zettelkasten/queries";
import { requireOwner } from "@/lib/auth";

/** Explicação curta — a dona instalou o pacote e não sabia pra que servia (03/10). */
function WhatIsIt() {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-black/[.06] bg-surface p-4 text-sm shadow-sm dark:border-white/[.06]">
      <h2 className="font-semibold text-black dark:text-zinc-50">O que é e pra que serve</h2>
      <p className="text-zinc-600 dark:text-zinc-300">
        Um jeito de guardar ideias de estudo e leitura: cada nota tem <strong>uma ideia só</strong>, escrita com suas palavras, e você liga
        uma nota na outra escrevendo <code>[[nome da outra nota]]</code>. Com o tempo vira uma rede de ideias que você reencontra pelas ligações.
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-zinc-600 dark:text-zinc-300">
        <li>
          <strong>Nota literária:</strong> o que você tirou de um livro, curso ou vídeo (com a fonte).
        </li>
        <li>
          <strong>Nota permanente:</strong> a ideia já pensada por você, que vale sozinha.
        </li>
      </ul>
      <p className="text-zinc-500 dark:text-zinc-400">
        <strong>É opcional.</strong> Se você não usa notas de estudo assim, pode ignorar — nada no resto do JKode depende dele.
      </p>
    </section>
  );
}

export default async function ZettelkastenPage() {
  const { supabase, user } = await requireOwner();

  const typeIds = await getZettelkastenTypeIds(supabase);
  if (!typeIds) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Zettelkasten</h1>
        <WhatIsIt />
        <section className="flex flex-col gap-2 rounded-2xl border border-black/[.06] bg-surface p-4 text-sm shadow-sm dark:border-white/[.06]">
          <h2 className="font-semibold text-black dark:text-zinc-50">Quero usar — e agora?</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-zinc-600 dark:text-zinc-300">
            <li>
              Abra{" "}
              <Link href="/configuracoes/metodos" className="font-medium text-brand-text underline">
                Configurações → Métodos
              </Link>{" "}
              e toque em <strong>Instalar</strong> no pacote “PARA, Zettelkasten e GTD”. Instalar não baixa nada pro seu aparelho: só cria
              os tipos de nota (Permanente, Literária) dentro do JKode.
            </li>
            <li>Ele pergunta o espaço: é onde essas notas vão ficar. O padrão — criar um espaço novo só pra isso — é o mais simples.</li>
            <li>Volte aqui: aparece “Nova nota permanente” e a lista das notas que ainda não se ligam a nenhuma outra.</li>
          </ol>
        </section>
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

      <WhatIsIt />

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
