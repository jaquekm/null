import Link from "next/link";
import type { BacklinkRow } from "../queries";

export function BacklinksPanel({ backlinks }: { backlinks: BacklinkRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Backlinks</h2>
      {backlinks.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum item ainda menciona este. Use <code>[[</code> no editor para mencionar.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {backlinks.map((link) => (
            <li key={link.id}>
              <Link
                href={`/itens/${link.id}`}
                className="block rounded-lg px-2 py-1.5 text-sm text-black transition-colors hover:bg-black/[.04] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                {link.title || "Sem título"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
