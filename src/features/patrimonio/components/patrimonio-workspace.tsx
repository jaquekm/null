"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatBRL, parseBRL } from "@/lib/money";
import { createNetWorthItem, deleteNetWorthItem, setNetWorthSnapshot } from "../actions";
import type { NetWorthKind } from "../lib/net-worth";
import type { NetWorthData, NetWorthItemRow } from "../queries";
import { NetWorthChart } from "./net-worth-chart";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const KIND_LABELS: Record<NetWorthKind, string> = { investimento: "Investimento", divida: "Dívida" };

function parseLenient(value: string): number | null {
  if (!value.trim()) return null;
  try {
    return parseBRL(value);
  } catch {
    return null;
  }
}

function ItemRow({ item, month, onChanged, onDeleted }: { item: NetWorthItemRow; month: string; onChanged: () => void; onDeleted: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.latestValueCents != null ? formatBRL(item.latestValueCents) : "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const cents = parseLenient(value);
    if (cents == null) {
      toast.error("Valor inválido.");
      return;
    }
    startTransition(async () => {
      const result = await setNetWorthSnapshot({ itemId: item.id, month, valueCents: cents });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Registrado.");
      setEditing(false);
      onChanged();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteNetWorthItem(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDeleted(item.id);
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl bg-surface-muted px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="truncate text-left text-sm font-medium text-black hover:underline dark:text-zinc-100"
        >
          {item.name}
        </button>
        <span className="shrink-0 text-sm text-zinc-600 dark:text-zinc-300">{item.latestValueCents != null ? formatBRL(item.latestValueCents) : "sem registro"}</span>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-black/[.06] pt-2 dark:border-white/[.08]">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="R$ 0,00"
            className={`${inputClassName} w-32`}
            aria-label={`Valor de ${item.name} neste mês`}
          />
          <button type="button" onClick={handleSave} disabled={pending} className="bg-brand text-brand-fg rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-60">
            Salvar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="ml-auto rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 dark:border-red-900 dark:text-red-400"
          >
            Excluir
          </button>
        </div>
      )}
    </li>
  );
}

function AddItemForm({ kind, onAdded }: { kind: NetWorthKind; onAdded: (item: NetWorthItemRow) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Dê um nome.");
      return;
    }
    startTransition(async () => {
      const result = await createNetWorthItem({ kind, name });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onAdded({ id: result.data.id, kind, name, latestValueCents: null, snapshots: [] });
      setName("");
      setAdding(false);
    });
  }

  if (!adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className="self-start text-sm font-medium text-brand-text hover:underline">
        + {KIND_LABELS[kind]}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={kind === "investimento" ? "Nome (ex.: Tesouro Selic)" : "Nome (ex.: Financiamento do carro)"}
        className={inputClassName}
        autoFocus
      />
      <button type="button" onClick={handleCreate} disabled={pending} className="bg-brand text-brand-fg rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60">
        Adicionar
      </button>
      <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
        Cancelar
      </button>
    </div>
  );
}

function Section({
  title,
  emptyLabel,
  kind,
  items,
  month,
  onChanged,
  onDeleted,
  onAdded,
}: {
  title: string;
  emptyLabel: string;
  kind: NetWorthKind;
  items: NetWorthItemRow[];
  month: string;
  onChanged: () => void;
  onDeleted: (id: string) => void;
  onAdded: (item: NetWorthItemRow) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-black dark:text-zinc-50">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-xl bg-surface-muted px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} month={month} onChanged={onChanged} onDeleted={onDeleted} />
          ))}
        </ul>
      )}
      <AddItemForm kind={kind} onAdded={onAdded} />
    </div>
  );
}

/** `/financas/patrimonio` (10.12): investimentos e dívidas no mesmo painel, evolução mês a mês. */
export function PatrimonioWorkspace({ initial, month }: { initial: NetWorthData; month: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);

  const investimentos = items.filter((item) => item.kind === "investimento");
  const dividas = items.filter((item) => item.kind === "divida");
  const totalInvestimentos = investimentos.reduce((sum, item) => sum + (item.latestValueCents ?? 0), 0);
  const totalDividas = dividas.reduce((sum, item) => sum + (item.latestValueCents ?? 0), 0);

  function handleDeleted(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function handleAdded(item: NetWorthItemRow) {
    setItems((current) => [...current, item]);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Patrimônio</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Investimentos e dívidas num só painel — registre o valor de cada um quando quiser, sem precisar ser todo mês.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-surface-muted px-3 py-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Investimentos</p>
          <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{formatBRL(totalInvestimentos)}</p>
        </div>
        <div className="rounded-xl bg-surface-muted px-3 py-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Dívidas</p>
          <p className="text-lg font-semibold text-red-700 dark:text-red-400">{formatBRL(totalDividas)}</p>
        </div>
        <div className="rounded-xl bg-surface-muted px-3 py-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Patrimônio líquido</p>
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{formatBRL(totalInvestimentos - totalDividas)}</p>
        </div>
      </div>

      <NetWorthChart data={initial.series} />

      <Section
        title="Investimentos"
        emptyLabel="Nenhum investimento cadastrado."
        kind="investimento"
        items={investimentos}
        month={month}
        onChanged={() => router.refresh()}
        onDeleted={handleDeleted}
        onAdded={handleAdded}
      />
      <Section
        title="Dívidas"
        emptyLabel="Nenhuma dívida cadastrada."
        kind="divida"
        items={dividas}
        month={month}
        onChanged={() => router.refresh()}
        onDeleted={handleDeleted}
        onAdded={handleAdded}
      />
    </div>
  );
}
