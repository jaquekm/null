"use client";

import { ChevronRight, FolderOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { filterSpaceItems, spaceSubcategories } from "../lib/filter-space-items";
import type { PublicSpaceItem } from "../queries";

const chipClassName = "rounded-full border px-3 py-1 text-xs transition-colors";

/**
 * Página de um espaço compartilhado (9.7): a lista de itens, com busca e
 * filtro por subcategoria; cada item abre dentro do próprio link, só pra ver.
 */
export function SharedSpaceContent({
  token,
  name,
  icon,
  subcategory,
  items,
}: {
  token: string;
  name: string;
  icon: string | null;
  subcategory: string | null;
  items: PublicSpaceItem[];
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const subcategories = useMemo(() => (subcategory ? [] : spaceSubcategories(items)), [items, subcategory]);
  const shown = filterSpaceItems(items, query, picked);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-brand-text">
          <FolderOpen className="h-3.5 w-3.5" aria-hidden /> Compartilhado com você · só leitura
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-black dark:text-zinc-50">
          {icon ? `${icon} ` : ""}
          {subcategory ? <span className="capitalize">{subcategory}</span> : name}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {subcategory ? `Subcategoria de ${name} · ` : ""}
          {items.length} {items.length === 1 ? "item" : "itens"}
        </p>
      </header>

      {items.length > 6 && (
        <label className="relative">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nesta lista…"
            className="w-full rounded-xl border border-black/[.08] bg-surface py-2.5 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.08]"
          />
        </label>
      )}

      {subcategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Subcategorias">
          <button
            type="button"
            onClick={() => setPicked(null)}
            aria-pressed={picked === null}
            className={`${chipClassName} ${picked === null ? "border-brand bg-brand-soft text-brand-text" : "border-black/[.1] text-zinc-600 dark:border-white/[.14] dark:text-zinc-300"}`}
          >
            Tudo
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub.name}
              type="button"
              onClick={() => setPicked(picked === sub.name ? null : sub.name)}
              aria-pressed={picked === sub.name}
              className={`${chipClassName} capitalize ${picked === sub.name ? "border-brand bg-brand-soft text-brand-text" : "border-black/[.1] text-zinc-600 dark:border-white/[.14] dark:text-zinc-300"}`}
            >
              {sub.name} <span className="text-zinc-400">{sub.count}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {shown.map((item) => (
          <li key={item.id}>
            <a
              href={`/p/${token}/i/${item.id}`}
              className="flex items-center gap-3 rounded-2xl border border-black/[.06] bg-surface px-4 py-3.5 shadow-sm transition-all hover:-translate-y-px hover:border-brand/40 hover:shadow-md dark:border-white/[.06]"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium text-black dark:text-zinc-50">{item.title || "Sem título"}</span>
                <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {[item.typeName, ...item.subcategories].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
            </a>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="rounded-2xl bg-surface-muted px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {items.length === 0 ? "Nada por aqui ainda." : "Nada com esse filtro."}
          </li>
        )}
      </ul>
    </div>
  );
}
