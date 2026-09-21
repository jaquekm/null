"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { archiveCategory, createCategory, renameCategory } from "../actions";
import type { CategoryRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

function CategoryRowItem({ category, onRenamed, onRemoved, pending }: { category: CategoryRow; onRenamed: () => void; onRemoved: () => void; pending: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [busy, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await renameCategory(category.id, name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      onRenamed();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await archiveCategory(category.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onRemoved();
    });
  }

  return (
    <li className={`flex items-center justify-between gap-2 py-1 text-sm ${category.parentId ? "pl-4" : ""}`}>
      {editing ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
          disabled={busy}
          className={`${inputClassName} py-1`}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-left text-black hover:underline dark:text-zinc-50">
          {category.name}
        </button>
      )}
      <button type="button" onClick={handleRemove} disabled={busy || pending} className="shrink-0 text-xs text-red-500 hover:underline disabled:opacity-60">
        Remover
      </button>
    </li>
  );
}

export function CategorySection({ categories }: { categories: CategoryRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [parentId, setParentId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const expenseTop = categories.filter((c) => c.kind === "expense" && !c.parentId);
  const incomeTop = categories.filter((c) => c.kind === "income" && !c.parentId);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);
  const topOptions = categories.filter((c) => c.kind === kind && !c.parentId);

  function handleCreate() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createCategory({ name, kind, parentId: parentId || undefined });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Categoria criada.");
      setName("");
      setParentId("");
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">2. Categorias</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Já vem com um conjunto padrão — revise, renomeie ou remova o que não fizer sentido.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-400">Despesas</p>
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.08]">
            {expenseTop.map((category) => (
              <div key={category.id}>
                <CategoryRowItem category={category} pending={pending} onRenamed={() => router.refresh()} onRemoved={() => router.refresh()} />
                {childrenOf(category.id).map((child) => (
                  <CategoryRowItem key={child.id} category={child} pending={pending} onRenamed={() => router.refresh()} onRemoved={() => router.refresh()} />
                ))}
              </div>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-400">Receitas</p>
          <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.08]">
            {incomeTop.map((category) => (
              <div key={category.id}>
                <CategoryRowItem category={category} pending={pending} onRenamed={() => router.refresh()} onRemoved={() => router.refresh()} />
                {childrenOf(category.id).map((child) => (
                  <CategoryRowItem key={child.id} category={child} pending={pending} onRenamed={() => router.refresh()} onRemoved={() => router.refresh()} />
                ))}
              </div>
            ))}
          </ul>
        </div>
      </div>

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={labelClassName}>
              Nome*
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} disabled={pending} />
              {fieldErrors.name && <span className="text-red-500">{fieldErrors.name[0]}</span>}
            </label>
            <label className={labelClassName}>
              Tipo
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as "income" | "expense");
                  setParentId("");
                }}
                className={inputClassName}
                disabled={pending}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </label>
            <label className={labelClassName}>
              Categoria pai (opcional)
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputClassName} disabled={pending}>
                <option value="">Nenhuma</option>
                {topOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending || !name.trim()}
              className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Criar categoria"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} disabled={pending} className="self-start rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="self-start text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          + Nova categoria
        </button>
      )}
    </div>
  );
}
