"use client";

import { FolderInput, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { moveItem } from "@/features/items/actions";
import { LIST_STYLE_INFO } from "@/features/items/lib/list-styles";
import { writeDraggedItem } from "../lib/item-drag";
import type { SidebarSpace } from "../queries";
import {
  browserFacets,
  EMPTY_FILTERS,
  filterBrowserItems,
  filtersToSearch,
  type BrowserFilters,
  type BrowserItem,
  type FacetOption,
} from "../lib/space-browser";

const controlClassName =
  "h-10 rounded-xl border border-black/[.08] bg-surface px-3 text-sm shadow-sm transition-colors hover:border-black/[.16] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.08] dark:hover:border-white/[.16]";

function FacetSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: FacetOption[];
  onChange: (value: string) => void;
}) {
  // Valor escolhido que sumiu das opções (ex.: a combinação zerou) continua na lista pra dar pra desfazer.
  const shown = value && !options.some((o) => o.value === value) ? [...options, { value, label: "(sem itens)", count: 0 }] : options;
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[13rem]">
      <span className="px-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${controlClassName} ${value ? "border-brand/50 text-brand-text" : ""}`}
      >
        <option value="">{allLabel}</option>
        {shown.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Página do espaço (pedido da dona): no lugar da fileira com todos os tipos
 * do sistema, busca + três filtros compactos — Tipo, Subcategoria (tags) e
 * Tipo de lista — que só mostram o que existe no espaço, com a contagem.
 * Filtra no navegador (instantâneo) e guarda os filtros na URL, pra voltar
 * de um item e cair no mesmo lugar.
 */
export function SpaceBrowser({
  spaceSlug,
  items: allItems,
  initialFilters,
  otherSpaces = [],
}: {
  spaceSlug: string;
  items: BrowserItem[];
  initialFilters: BrowserFilters;
  /** Os outros espaços: destino do "Mover para…" de cada linha. */
  otherSpaces?: SidebarSpace[];
}) {
  const router = useRouter();
  const [, startMoving] = useTransition();
  // Item que acabou de ser movido some na hora, sem esperar a página recarregar.
  const [moved, setMoved] = useState<ReadonlySet<string>>(new Set());
  const items = useMemo(() => allItems.filter((item) => !moved.has(item.id)), [allItems, moved]);
  const [filters, setFilters] = useState(initialFilters);
  const facets = useMemo(() => browserFacets(items, filters), [items, filters]);
  const shown = useMemo(() => filterBrowserItems(items, filters), [items, filters]);
  const active = filters.q || filters.typeId || filters.tagId || filters.listStyle;

  function moveTo(item: BrowserItem, space: SidebarSpace) {
    startMoving(async () => {
      const result = await moveItem(item.id, space.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMoved((prev) => new Set(prev).add(item.id));
      toast.success(`“${item.title || "Sem título"}” foi para ${space.name}.`);
      router.refresh();
    });
  }

  function update(next: Partial<BrowserFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    try {
      window.history.replaceState(null, "", `/espacos/${spaceSlug}${filtersToSearch(merged)}`);
    } catch {
      // Sem histórico (ex.: iframe restrito) o filtro funciona do mesmo jeito, só não fica na URL.
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <label className="relative">
          <span className="sr-only">Buscar neste espaço</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Buscar pelo nome…"
            className={`${controlClassName} w-full pl-9`}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <FacetSelect label="Tipo" allLabel="Todos os tipos" value={filters.typeId} options={facets.types} onChange={(typeId) => update({ typeId })} />
          <FacetSelect label="Subcategoria" allLabel="Todas" value={filters.tagId} options={facets.tags} onChange={(tagId) => update({ tagId })} />
          {(facets.listStyles.length > 0 || filters.listStyle) && (
            <FacetSelect
              label="Tipo de lista"
              allLabel="Todos"
              value={filters.listStyle}
              options={facets.listStyles}
              onChange={(listStyle) => update({ listStyle })}
            />
          )}
          {active && (
            <button
              type="button"
              onClick={() => update(EMPTY_FILTERS)}
              className="flex h-10 items-center gap-1 rounded-xl px-3 text-sm text-zinc-500 hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50"
            >
              <X className="h-4 w-4" aria-hidden /> Limpar
            </button>
          )}
        </div>
      </div>

      <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {shown.length} {shown.length === 1 ? "item" : "itens"}
        {active ? " com esses filtros" : ""}
      </p>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[.12] px-4 py-10 text-center text-sm text-zinc-500 dark:border-white/[.12] dark:text-zinc-400">
          {items.length === 0 ? "Este espaço ainda está vazio. Use “+ Novo” para criar o primeiro item." : "Nada encontrado com esses filtros."}
          {active && items.length > 0 && (
            <button type="button" onClick={() => update(EMPTY_FILTERS)} className="ml-1 font-medium text-brand-text hover:underline">
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <Link
                href={`/itens/${item.id}`}
                draggable
                onDragStart={(event) => writeDraggedItem(event.dataTransfer, { id: item.id, title: item.title })}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-black/[.06] bg-surface px-4 py-3 shadow-sm transition-all hover:-translate-y-px hover:border-brand/40 hover:shadow-md dark:border-white/[.06]"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-base group-hover:bg-brand-soft"
                >
                  {item.typeIcon && !/^[A-Za-z]/.test(item.typeIcon) ? item.typeIcon : (item.typeName ?? "•").slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium text-black dark:text-zinc-50">{item.title || "Sem título"}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{item.typeName ?? "Sem tipo"}</span>
                    {item.listStyle && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand-text">{LIST_STYLE_INFO[item.listStyle].label}</span>}
                    {item.tags.map((tag) => (
                      <span key={tag.id} className="rounded-full bg-surface-muted px-2 py-0.5 text-zinc-600 dark:text-zinc-300">
                        {tag.name}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{formatDate(item.updatedAt)}</span>
              </Link>
              {otherSpaces.length > 0 && (
                <label
                  title="Mover para outro espaço — ou arraste a linha até um espaço na barra lateral"
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/[.08] text-zinc-500 transition-colors focus-within:ring-2 focus-within:ring-brand/40 hover:border-black/[.16] hover:text-black dark:border-white/[.08] dark:text-zinc-400 dark:hover:border-white/[.16] dark:hover:text-zinc-50"
                >
                  <FolderInput className="h-4 w-4" aria-hidden />
                  <select
                    aria-label={`Mover “${item.title || "Sem título"}” para outro espaço`}
                    value=""
                    onChange={(event) => {
                      const space = otherSpaces.find((candidate) => candidate.id === event.target.value);
                      if (space) moveTo(item, space);
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    <option value="" disabled>
                      Mover para…
                    </option>
                    {otherSpaces.map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.icon ? `${space.icon} ` : ""}
                        {space.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
