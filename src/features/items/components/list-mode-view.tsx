"use client";

import type { JSONContent } from "@tiptap/core";
import { Check, ChevronDown, ChevronUp, Star } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { updateItemContent } from "../actions";
import { toggleChecklistItem } from "../lib/checklist";
import {
  addItemToSection,
  addSection,
  chooseOnly,
  listEntries,
  listSections,
  moveListItem,
  setItemScore,
  sortByScore,
  type ListEntry,
  type ListStyle,
} from "../lib/list-styles";

const inputClassName =
  "w-full rounded-xl border border-dashed border-black/[.14] bg-transparent px-4 py-3 text-base transition-colors placeholder:text-zinc-400 hover:border-black/[.25] focus:border-solid focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.14] dark:hover:border-white/[.25]";
const rowClassName =
  "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base shadow-sm transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-60";
const idleRow = "border-black/[.06] bg-surface text-black dark:border-white/[.06] dark:text-zinc-50";
const pickedRow = "border-brand/60 bg-brand-soft text-black dark:text-zinc-50";

function EntryText({ entry }: { entry: ListEntry }) {
  return <span className="min-w-0 flex-1 break-words">{entry.text || <span className="italic text-zinc-400">(sem texto)</span>}</span>;
}

function Empty() {
  return <p className="text-sm text-zinc-500 dark:text-zinc-400">Lista vazia — adicione o primeiro item abaixo.</p>;
}

function AddInput({ placeholder, disabled, onAdd }: { placeholder: string; disabled: boolean; onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const value = text.trim();
        if (!value) return;
        setText("");
        onAdd(value);
      }}
      disabled={disabled}
      placeholder={placeholder}
      className={inputClassName}
    />
  );
}

function Tally({ children }: { children: ReactNode }) {
  return <p className="text-xs text-zinc-500 dark:text-zinc-400">{children}</p>;
}

/**
 * Modo lista (5.9, pack Listas): versão pra celular do conteúdo da lista,
 * com o comportamento do tipo escolhido (Riscar, Marcar vários, Escolher um,
 * Dar nota, Ordenar e agrupar — `lib/list-styles.ts`). Opera no mesmo
 * `content`/`updatedAt` do editor completo (`ItemEditor`).
 */
export function ListModeView({
  itemId,
  style,
  content,
  updatedAt,
  onSaved,
  onContentChange,
}: {
  itemId: string;
  style: ListStyle;
  content: JSONContent | null;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
  onContentChange: (content: JSONContent) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [targetGroup, setTargetGroup] = useState<number | null>(null);

  const entries = useMemo(() => listEntries(content), [content]);
  const sections = useMemo(() => listSections(content), [content]);

  function save(nextContent: JSONContent) {
    setError(null);
    onContentChange(nextContent);
    startTransition(async () => {
      const result = await updateItemContent(itemId, updatedAt, nextContent);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data) onSaved(result.data.updatedAt);
    });
  }

  const doc: JSONContent = content ?? { type: "doc", content: [] };
  const lastGroup = sections.length - 1;
  const addTo = targetGroup !== null && targetGroup <= lastGroup ? targetGroup : lastGroup;
  const add = (text: string) => save(addItemToSection(content, style === "priority" ? addTo : lastGroup, text));

  let body: ReactNode;

  if (style === "checklist") {
    const ordered = [...entries].sort((a, b) => Number(a.checked) - Number(b.checked));
    body = (
      <ul className="flex flex-col gap-2">
        {ordered.map((entry) => (
          <li key={entry.index}>
            <button
              type="button"
              disabled={pending}
              onClick={() => save(toggleChecklistItem(doc, entry.index, !entry.checked))}
              className={`${rowClassName} border-black/[.06] bg-surface dark:border-white/[.06] ${
                entry.checked ? "text-zinc-400 line-through dark:text-zinc-600" : "text-black dark:text-zinc-50"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  entry.checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20 dark:border-white/25"
                }`}
              >
                {entry.checked && <Check className="h-4 w-4" />}
              </span>
              <EntryText entry={entry} />
            </button>
          </li>
        ))}
        {ordered.length === 0 && <Empty />}
      </ul>
    );
  } else if (style === "multi") {
    const picked = entries.filter((e) => e.checked).length;
    const shown = onlyPicked ? entries.filter((e) => e.checked) : entries;
    body = (
      <>
        <div className="flex items-center justify-between gap-2">
          <Tally>
            {picked} de {entries.length} marcados
          </Tally>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={onlyPicked} onChange={(e) => setOnlyPicked(e.target.checked)} />
            Só os marcados
          </label>
        </div>
        <ul className="flex flex-col gap-2">
          {shown.map((entry) => (
            <li key={entry.index}>
              <button
                type="button"
                role="checkbox"
                aria-checked={entry.checked}
                disabled={pending}
                onClick={() => save(toggleChecklistItem(doc, entry.index, !entry.checked))}
                className={`${rowClassName} ${entry.checked ? pickedRow : idleRow}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                    entry.checked ? "border-brand bg-brand text-white" : "border-black/20 dark:border-white/25"
                  }`}
                >
                  {entry.checked && <Check className="h-4 w-4" />}
                </span>
                <EntryText entry={entry} />
              </button>
            </li>
          ))}
          {entries.length === 0 && <Empty />}
        </ul>
      </>
    );
  } else if (style === "single") {
    const chosen = entries.find((e) => e.checked);
    body = (
      <>
        <Tally>{chosen ? <>Escolha: <strong className="font-semibold text-black dark:text-zinc-50">{chosen.text || "(sem texto)"}</strong></> : "Nenhuma opção escolhida ainda."}</Tally>
        <ul role="radiogroup" className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.index}>
              <button
                type="button"
                role="radio"
                aria-checked={entry.checked}
                disabled={pending}
                onClick={() => save(chooseOnly(doc, entry.index))}
                className={`${rowClassName} ${entry.checked ? pickedRow : idleRow}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    entry.checked ? "border-brand" : "border-black/20 dark:border-white/25"
                  }`}
                >
                  {entry.checked && <span className="h-3 w-3 rounded-full bg-brand" />}
                </span>
                <EntryText entry={entry} />
              </button>
            </li>
          ))}
          {entries.length === 0 && <Empty />}
        </ul>
      </>
    );
  } else if (style === "rating") {
    const rated = entries.filter((e) => e.score !== null).length;
    body = (
      <>
        <Tally>
          {rated} de {entries.length} com nota · do mais bem avaliado para o menos
        </Tally>
        <ul className="flex flex-col gap-2">
          {sortByScore(entries).map((entry) => (
            <li key={entry.index} className={`${rowClassName} ${idleRow} flex-wrap`}>
              <EntryText entry={entry} />
              <span className="flex shrink-0" role="group" aria-label={`Nota de ${entry.text}`}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = (entry.score ?? 0) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={pending}
                      aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                      aria-pressed={entry.score === n}
                      // Tocar de novo na nota atual apaga a nota.
                      onClick={() => save(setItemScore(doc, entry.index, entry.score === n ? null : n))}
                      className="p-1"
                    >
                      <Star className={`h-6 w-6 ${on ? "fill-amber-400 text-amber-400" : "text-zinc-300 dark:text-zinc-600"}`} />
                    </button>
                  );
                })}
              </span>
            </li>
          ))}
          {entries.length === 0 && <Empty />}
        </ul>
      </>
    );
  } else {
    const flat = sections.flatMap((s) => s.entries);
    const rankOf = new Map(flat.map((entry, i) => [entry.index, i + 1]));
    const first = flat[0]?.index;
    const last = flat[flat.length - 1]?.index;
    body = (
      <div className="flex flex-col gap-4">
        {sections.map((section, sectionIndex) => (
          <section key={`${sectionIndex}-${section.title ?? ""}`} className="flex flex-col gap-2">
            {section.title !== null && <h3 className="px-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{section.title}</h3>}
            <ol className="flex flex-col gap-2">
              {section.entries.map((entry) => {
                const rank = rankOf.get(entry.index);
                return (
                  <li key={entry.index} className={`${rowClassName} ${idleRow} py-2 pr-2`}>
                    <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">{rank}</span>
                    <EntryText entry={entry} />
                    <span className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        aria-label={`Subir ${entry.text}`}
                        disabled={pending || entry.index === first}
                        onClick={() => save(moveListItem(doc, entry.index, "up"))}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-black/[.05] disabled:opacity-25 dark:text-zinc-400 dark:hover:bg-white/[.08]"
                      >
                        <ChevronUp className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Descer ${entry.text}`}
                        disabled={pending || entry.index === last}
                        onClick={() => save(moveListItem(doc, entry.index, "down"))}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-black/[.05] disabled:opacity-25 dark:text-zinc-400 dark:hover:bg-white/[.08]"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
            {section.entries.length === 0 && (
              <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                {flat.length === 0 ? "Lista vazia — adicione o primeiro item abaixo." : "Grupo vazio — traga itens com as setas ou adicione abaixo."}
              </p>
            )}
          </section>
        ))}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">As setas mudam a ordem; no topo ou no fim de um grupo, o item passa para o grupo vizinho.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {body}

      {style === "priority" && sections.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          Adicionar em
          <select
            value={addTo}
            onChange={(e) => setTargetGroup(Number(e.target.value))}
            className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm dark:border-white/[.16]"
          >
            {sections.map((section, i) => (
              <option key={i} value={i}>
                {section.title ?? "Sem grupo"}
              </option>
            ))}
          </select>
        </label>
      )}
      <AddInput placeholder="Adicionar item e apertar Enter…" disabled={pending} onAdd={add} />

      {style === "priority" && (
        <input
          type="text"
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const title = newGroup.trim();
            if (!title) return;
            setNewGroup("");
            setTargetGroup(sections[0]?.entries.length === 0 && sections[0]?.title === null ? 0 : sections.length);
            save(addSection(content, title));
          }}
          disabled={pending}
          placeholder="Novo grupo (ex.: Saúde) e apertar Enter…"
          className={`${inputClassName} border-dashed text-sm`}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
