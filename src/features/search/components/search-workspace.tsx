"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { BrowseItemRow, TypeOptionWithFields } from "@/features/items/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import type { TagOption } from "@/features/tags/queries";
import { searchItems, type SearchResultRow as SearchResultData } from "../actions";
import { dateRangeToIso } from "../lib/date-range-to-iso";
import { extractTagFilter } from "../lib/extract-tag-filter";
import { SearchResultRow } from "./search-result-row";

const DEBOUNCE_MS = 250;

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const STATUS_OPTIONS = [
  { value: "", label: "Qualquer status" },
  { value: "inbox", label: "Inbox" },
  { value: "active", label: "Ativo" },
  { value: "archived", label: "Arquivado" },
];

export function SearchWorkspace({
  spaces,
  types,
  tags,
  pinned,
  recent,
}: {
  spaces: SidebarSpace[];
  types: TypeOptionWithFields[];
  tags: TagOption[];
  pinned: BrowseItemRow[];
  recent: BrowseItemRow[];
}) {
  const [query, setQuery] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [tagId, setTagId] = useState("");
  const [status, setStatus] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [results, setResults] = useState<SearchResultData[] | null>(null);
  const [pending, startTransition] = useTransition();

  const spaceById = useMemo(() => new Map(spaces.map((space) => [space.id, space])), [spaces]);
  const typeById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);

  const { text: textForSearch, tagId: tagFromText } = useMemo(() => extractTagFilter(query, tags), [query, tags]);
  const effectiveTagId = tagFromText ?? (tagId || null);
  const hasQuery = textForSearch !== "" || effectiveTagId !== null;

  useEffect(() => {
    if (!hasQuery) return;

    const timer = setTimeout(() => {
      const { after, before } = dateRangeToIso(updatedFrom, updatedTo);
      startTransition(async () => {
        const data = await searchItems(textForSearch, {
          spaceId: spaceId || null,
          typeId: typeId || null,
          tagId: effectiveTagId,
          status: status || null,
          updatedAfter: after,
          updatedBefore: before,
        });
        setResults(data);
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [hasQuery, textForSearch, effectiveTagId, spaceId, typeId, status, updatedFrom, updatedTo]);

  const showEmptyState = !hasQuery;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Buscar</h1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar... use #tag para filtrar por tag"
        autoFocus
        className={`${inputClassName} w-full`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Espaço" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={inputClassName}>
          <option value="">Qualquer espaço</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.icon ? `${space.icon} ` : ""}
              {space.name}
            </option>
          ))}
        </select>
        <select aria-label="Tipo" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClassName}>
          <option value="">Qualquer tipo</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tag"
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          disabled={tagFromText !== null}
          className={inputClassName}
        >
          <option value="">Qualquer tag</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              #{tag.name}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClassName}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          de
          <input
            type="date"
            aria-label="Atualizado de"
            value={updatedFrom}
            onChange={(e) => setUpdatedFrom(e.target.value)}
            className={inputClassName}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          até
          <input
            type="date"
            aria-label="Atualizado até"
            value={updatedTo}
            onChange={(e) => setUpdatedTo(e.target.value)}
            className={inputClassName}
          />
        </label>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col gap-6">
          {pinned.length > 0 && (
            <section className="flex flex-col gap-1">
              <h2 className="px-3 text-xs font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                Fixados
              </h2>
              {pinned.map((item) => (
                <SearchResultRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  space={item.spaceId ? spaceById.get(item.spaceId) : undefined}
                  type={item.typeId ? typeById.get(item.typeId) : undefined}
                />
              ))}
            </section>
          )}
          <section className="flex flex-col gap-1">
            <h2 className="px-3 text-xs font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
              Recentes
            </h2>
            {recent.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Nada por aqui ainda.</p>
            ) : (
              recent.map((item) => (
                <SearchResultRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  space={item.spaceId ? spaceById.get(item.spaceId) : undefined}
                  type={item.typeId ? typeById.get(item.typeId) : undefined}
                />
              ))
            )}
          </section>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {pending && results !== null && (
            <p className="px-3 text-xs text-zinc-400 dark:text-zinc-500">Atualizando...</p>
          )}
          {results === null ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nada encontrado.</p>
          ) : (
            results.map((result) => (
              <SearchResultRow
                key={result.id}
                id={result.id}
                title={result.title}
                snippet={result.snippet}
                space={result.spaceId ? spaceById.get(result.spaceId) : undefined}
                type={result.typeId ? typeById.get(result.typeId) : undefined}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
