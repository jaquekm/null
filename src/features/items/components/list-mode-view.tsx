"use client";

import type { JSONContent } from "@tiptap/core";
import { Bell, Check, ChevronDown, ChevronUp, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { splitLinks } from "@/lib/linkify";
import { QuickReminder } from "@/features/reminders/components/quick-reminder";
import { updateItemContent } from "../actions";
import { toggleChecklistItem } from "../lib/checklist";
import { hasConvertibleLines, listNoteLines, noteLinesToListItems } from "../lib/list-notes";
import {
  addItemToSection,
  addSection,
  chooseOnly,
  listEntries,
  listSections,
  moveListItem,
  removeListItem,
  setItemDetails,
  setItemScore,
  setItemText,
  sortByScore,
  type ListEntry,
  type ListStyle,
} from "../lib/list-styles";

const inputClassName =
  "w-full rounded-xl border border-dashed border-black/[.14] bg-transparent px-4 py-3 text-base transition-colors placeholder:text-zinc-400 hover:border-black/[.25] focus:border-solid focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.14] dark:hover:border-white/[.25]";
const rowClassName =
  "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base shadow-sm transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-60";
/** Linha-botão (Riscar, Marcar vários, Escolher um): ocupa o espaço que sobra ao lado dos ícones. */
const rowButtonClassName = rowClassName.replace("w-full", "min-w-0 flex-1");
const idleRow = "border-black/[.06] bg-surface text-black dark:border-white/[.06] dark:text-zinc-50";
const pickedRow = "border-brand/60 bg-brand-soft text-black dark:text-zinc-50";

function EntryText({ entry }: { entry: ListEntry }) {
  return <span className="min-w-0 flex-1 break-words">{entry.text || <span className="italic text-zinc-400">(sem texto)</span>}</span>;
}

/** Texto com os links clicáveis (abrem em outra aba). */
function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="break-all text-brand-text underline">
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * "⋮" de cada item (pedido da dona, 07/10 — um botão só em vez de vários):
 * Editar (nome e detalhes), Me lembrar e Excluir.
 */
function EntryMenu({
  entry,
  itemId,
  timezone,
  canRemind,
  pending,
  onEdit,
  onDelete,
}: {
  entry: ListEntry;
  itemId: string;
  timezone?: string;
  canRemind: boolean;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Posição do menu na tela (fixed, num portal): dentro da linha, a linha de baixo ficava por cima dele.
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const open = position !== null;
  const [reminderOpen, setReminderOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  const name = entry.text || "item";
  const showReminder = Boolean(timezone && canRemind && entry.text.trim());

  function toggle() {
    if (open) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Perto do fim da tela, abre pra cima (o menu tem ~3 linhas).
    const MENU_HEIGHT = 156;
    const top = rect.bottom + 4 + MENU_HEIGHT > window.innerHeight ? Math.max(8, rect.top - 4 - MENU_HEIGHT) : rect.bottom + 4;
    setPosition({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }
  const close = () => setPosition(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setPosition(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPosition(null);
    }
    function onScroll() {
      setPosition(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const itemClassName =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-black/[.05] disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-white/[.08]";

  return (
    <span className="shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Opções de ${name}`}
        className={`rounded-lg p-2 hover:bg-black/[.05] dark:hover:bg-white/[.08] ${entry.details ? "text-brand-text" : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"}`}
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>
      {position &&
        createPortal(
        <span
          ref={menuRef}
          role="menu"
          aria-label={`Opções de ${name}`}
          style={{ top: position.top, right: position.right }}
          className="fixed z-50 flex w-52 flex-col rounded-xl border border-black/[.08] bg-surface p-1 shadow-xl dark:border-white/[.1]"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClassName}
            onClick={() => {
              close();
              onEdit();
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden /> Editar e detalhes
          </button>
          {showReminder && (
            <button
              type="button"
              role="menuitem"
              className={itemClassName}
              onClick={() => {
                close();
                setReminderOpen(true);
              }}
            >
              <Bell className="h-4 w-4" aria-hidden /> Me lembrar
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            className={`${itemClassName} text-red-600 dark:text-red-400`}
            onClick={() => {
              close();
              if (window.confirm(`Excluir “${name}” da lista?${entry.details ? " Os detalhes vão junto." : ""}`)) onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Excluir
          </button>
        </span>,
        document.body,
      )}
      {showReminder && (
        <QuickReminder variant="none" open={reminderOpen} onOpenChange={setReminderOpen} title={entry.text} timezone={timezone!} itemId={itemId} sourceType="list_entry" />
      )}
    </span>
  );
}

const panelInputClassName =
  "rounded-lg border border-black/[.12] bg-surface px-3 py-2 text-sm font-normal text-black focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.16] dark:text-zinc-50";

/** Embaixo do item: o resumo dos detalhes (fechado) ou o painel do item (aberto). */
function EntryDetails({
  entry,
  open,
  pending,
  onSave,
  onClose,
}: {
  entry: ListEntry;
  open: boolean;
  pending: boolean;
  onSave: (name: string, details: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(entry.text);
  const [draft, setDraft] = useState(entry.details);
  if (!open) {
    if (!entry.details) return null;
    return (
      <p className="w-full basis-full whitespace-pre-line break-words pl-1 text-sm text-zinc-600 line-clamp-3 dark:text-zinc-300">
        <LinkedText text={entry.details} />
      </p>
    );
  }
  const changed = name.trim() !== entry.text.trim() || draft.trim() !== entry.details;
  return (
    <div className="flex w-full basis-full flex-col gap-3 rounded-xl bg-surface-muted p-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Nome
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={pending} maxLength={500} className={panelInputClassName} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Detalhes
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          autoFocus
          disabled={pending}
          placeholder={"Link, endereço, valores, o que for — uma informação por linha.\nEx.: https://…\nCentro, perto da praia\nR$ 450 a diária"}
          className={panelInputClassName}
        />
      </label>
      {splitLinks(draft).some((part) => part.href) && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Links: <LinkedText text={splitLinks(draft).filter((part) => part.href).map((part) => part.text).join("  ")} />
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !changed || !name.trim()}
          onClick={() => onSave(name, draft)}
          className="bg-brand text-brand-fg rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Salvar
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
          Fechar
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Os detalhes aparecem embaixo do item aqui, no editor completo e no link compartilhado.</p>
    </div>
  );
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
  timezone,
  onEditText,
}: {
  itemId: string;
  style: ListStyle;
  content: JSONContent | null;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
  onContentChange: (content: JSONContent) => void;
  /** Com o fuso, cada linha ganha o sininho "Me lembrar" (9.4). */
  timezone?: string;
  /** "Editar texto": troca pro editor completo. */
  onEditText?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [targetGroup, setTargetGroup] = useState<number | null>(null);
  // Item com os detalhes abertos (07/10) — um por vez.
  const [openDetails, setOpenDetails] = useState<number | null>(null);

  const entries = useMemo(() => listEntries(content), [content]);
  const notes = useMemo(() => listNoteLines(content, style), [content, style]);
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
  const menu = (entry: ListEntry, canRemind = true) => (
    <EntryMenu
      entry={entry}
      itemId={itemId}
      timezone={timezone}
      // Item já riscado não precisa de lembrete.
      canRemind={canRemind}
      pending={pending}
      onEdit={() => setOpenDetails(entry.index)}
      onDelete={() => {
        save(removeListItem(doc, entry.index));
        setOpenDetails(null);
      }}
    />
  );
  const details = (entry: ListEntry) => (
    <EntryDetails
      // A chave muda quando os detalhes salvos mudam: o rascunho recomeça do que está gravado.
      key={`${entry.index}:${entry.text}:${entry.details}`}
      entry={entry}
      open={openDetails === entry.index}
      pending={pending}
      onClose={() => setOpenDetails(null)}
      onSave={(name, text) => {
        save(setItemDetails(setItemText(doc, entry.index, name), entry.index, text));
        setOpenDetails(null);
      }}

    />
  );
  const add = (text: string) => save(addItemToSection(content, style === "priority" ? addTo : lastGroup, text));

  let body: ReactNode;

  if (style === "checklist") {
    const ordered = [...entries].sort((a, b) => Number(a.checked) - Number(b.checked));
    body = (
      <ul className="flex flex-col gap-2">
        {ordered.map((entry) => (
          <li key={entry.index} className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => save(toggleChecklistItem(doc, entry.index, !entry.checked))}
              className={`${rowButtonClassName} border-black/[.06] bg-surface dark:border-white/[.06] ${
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
            {menu(entry, !entry.checked)}
            {details(entry)}
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
            <li key={entry.index} className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={entry.checked}
                disabled={pending}
                onClick={() => save(toggleChecklistItem(doc, entry.index, !entry.checked))}
                className={`${rowButtonClassName} ${entry.checked ? pickedRow : idleRow}`}
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
              {menu(entry)}
              {details(entry)}
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
            <li key={entry.index} className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                role="radio"
                aria-checked={entry.checked}
                disabled={pending}
                onClick={() => save(chooseOnly(doc, entry.index))}
                className={`${rowButtonClassName} ${entry.checked ? pickedRow : idleRow}`}
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
              {menu(entry)}
              {details(entry)}
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
              {/* Tocar no nome abre os detalhes (07/10). */}
              <button
                type="button"
                onClick={() => setOpenDetails(openDetails === entry.index ? null : entry.index)}
                className="min-w-0 basis-full break-words text-left sm:basis-0 sm:flex-1"
              >
                {entry.text || <span className="italic text-zinc-400">(sem texto)</span>}
              </button>
              <span className="ml-auto flex shrink-0 items-center">
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
              {menu(entry)}
              </span>
              {details(entry)}
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
                  <li key={entry.index} className={`${rowClassName} ${idleRow} flex-wrap py-2 pr-2`}>
                    <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">{rank}</span>
                    <EntryText entry={entry} />
                    <span className="flex shrink-0 items-center gap-0.5">
                      {menu(entry)}
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
                    {details(entry)}
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
      {notes.length > 0 && (
        <section aria-label="Texto da lista" className="flex flex-col gap-2 rounded-2xl border border-black/[.06] bg-surface px-4 py-3 shadow-sm dark:border-white/[.06]">
          <div className="flex flex-col gap-1 text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
            {notes.map((line, i) =>
              line.kind === "heading" ? (
                <p key={i} className="font-semibold text-black dark:text-zinc-50">
                  {line.text}
                </p>
              ) : (
                <p key={i} className="break-words">
                  {line.kind === "bullet" && <span className="mr-1.5 text-zinc-400">•</span>}
                  {line.text}
                </p>
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-black/[.06] pt-2 dark:border-white/[.06]">
            {onEditText && (
              <button
                type="button"
                onClick={onEditText}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-text hover:bg-brand-soft"
              >
                Editar texto
              </button>
            )}
            {hasConvertibleLines(content, style) && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Cada linha do texto vira um item da lista (com caixinha). Continuar?")) return;
                  save(noteLinesToListItems(content));
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-black/[.05] disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-white/[.08]"
              >
                Transformar as linhas em itens da lista
              </button>
            )}
          </div>
        </section>
      )}

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
