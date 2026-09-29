"use client";

import { ArrowLeft, Plus, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { createItemFromTemplate } from "@/features/templates/actions";
import { availableTemplates, type ItemTemplate } from "@/features/templates/lib/templates";
import type { Result } from "@/lib/result";
import { createItemInSpace } from "../actions";
import type { SpaceTypeOption } from "../queries";

const inputClassName =
  "w-full rounded-xl border border-black/[.08] bg-surface-muted px-3 py-2.5 text-sm transition-colors hover:border-black/[.16] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.08] dark:hover:border-white/[.16]";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

const initialState: Result<null> = { ok: true, data: null };

function TemplateForm({ template, spaceId, subcategories, onBack }: { template: ItemTemplate; spaceId: string; subcategories: string[]; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(createItemFromTemplate, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="templateId" value={template.id} />
      <input type="hidden" name="spaceId" value={spaceId} />
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-2xl">
          {template.emoji}
        </span>
        <div>
          <p className="font-semibold text-black dark:text-zinc-50">{template.label}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{template.description}</p>
        </div>
      </div>
      <label className={labelClassName}>
        Nome
        <input name="title" autoFocus maxLength={200} placeholder={template.titlePlaceholder} className={inputClassName} />
      </label>
      <label className={labelClassName}>
        Subcategoria (opcional)
        <input name="subcategory" maxLength={50} list="subcategorias-existentes" placeholder="Ex.: Cunhada, Casa, Viagens" className={inputClassName} />
        <datalist id="subcategorias-existentes">
          {subcategories.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Outros modelos
        </button>
        <button type="submit" disabled={pending} className="bg-brand text-brand-fg rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60">
          {pending ? "Criando…" : "Criar"}
        </button>
      </div>
    </form>
  );
}

function BlankForm({ spaceId, types, defaultTypeId, onBack }: { spaceId: string; types: SpaceTypeOption[]; defaultTypeId?: string; onBack: () => void }) {
  const [state, formAction, pending] = useActionState(createItemInSpace, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="spaceId" value={spaceId} />
      <p className="font-semibold text-black dark:text-zinc-50">Em branco</p>
      <label className={labelClassName}>
        Nome
        <input name="title" autoFocus maxLength={200} placeholder="Título" className={inputClassName} />
      </label>
      <label className={labelClassName}>
        Tipo
        <select name="typeId" defaultValue={defaultTypeId ?? ""} className={inputClassName}>
          <option value="">Sem tipo</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Modelos
        </button>
        <button type="submit" disabled={pending} className="bg-brand text-brand-fg rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60">
          {pending ? "Criando…" : "Criar"}
        </button>
      </div>
    </form>
  );
}

/**
 * "+ Novo" do espaço (9.2): primeiro o que a dona quer fazer (modelos prontos
 * — lista de presentes, reunião, documento…), com "Em branco" pra escolher o
 * tipo à mão como antes. Só aparecem modelos cujo tipo existe pra ela.
 */
export function NewItemButton({
  spaceId,
  types,
  defaultTypeId,
  typeSlugs = [],
  subcategories = [],
}: {
  spaceId: string;
  types: SpaceTypeOption[];
  /** Tipo filtrado na página (`?tipo=`), pré-selecionado no "Em branco". */
  defaultTypeId?: string;
  /** Slugs de todos os tipos da dona — decide quais modelos aparecem. */
  typeSlugs?: string[];
  /** Subcategorias (tags) já usadas no espaço, sugeridas no campo. */
  subcategories?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ItemTemplate | "blank" | null>(null);
  const templates = availableTemplates(typeSlugs.length > 0 ? typeSlugs : types.map((t) => t.slug));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setChoice(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand text-brand-fg flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Novo
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="novo-titulo"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-black/[.08] bg-surface p-5 shadow-2xl sm:rounded-3xl dark:border-white/[.08]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="novo-titulo" className="text-lg font-semibold text-black dark:text-zinc-50">
                {choice ? "Criar" : "O que você quer criar?"}
              </h2>
              <button type="button" onClick={close} aria-label="Fechar" className="rounded-full p-1.5 text-zinc-500 hover:bg-black/[.05] dark:hover:bg-white/[.08]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {choice === null && (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => setChoice(template)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-black/[.06] bg-surface px-3 py-3 text-left transition-all hover:-translate-y-px hover:border-brand/40 hover:shadow-md dark:border-white/[.06]"
                    >
                      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xl">
                        {template.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-black dark:text-zinc-50">{template.label}</span>
                        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{template.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => setChoice("blank")}
                    className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-black/[.14] px-3 py-3 text-left hover:border-brand/40 dark:border-white/[.14]"
                  >
                    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xl">
                      ＋
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-black dark:text-zinc-50">Em branco</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">Escolher o tipo à mão</span>
                    </span>
                  </button>
                </li>
              </ul>
            )}

            {choice === "blank" && <BlankForm spaceId={spaceId} types={types} defaultTypeId={defaultTypeId} onBack={() => setChoice(null)} />}
            {choice && choice !== "blank" && <TemplateForm template={choice} spaceId={spaceId} subcategories={subcategories} onBack={() => setChoice(null)} />}
          </div>
        </div>
      )}
    </>
  );
}
