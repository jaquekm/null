"use client";

import { ChevronLeft, ChevronRight, Filter, LayoutDashboard, PiggyBank, Plus, Receipt, Settings, Upload, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { formatBRL } from "@/lib/money";
import { bulkCategorizeTransactions, createRule, deleteTransaction, searchTransactions, updateTransactionCategory, updateTransactionDescription } from "../actions";
import { normalizeDescription } from "../lib/normalize-description";
import { monthPeriod, shiftMonth } from "../lib/period-range";
import type { TransactionTotals } from "../lib/transaction-totals";
import type { AccountRow, CategoryRow, TransactionRow } from "../queries";
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPE_FILTER_LABELS,
  TRANSACTION_TYPE_FILTERS,
  type TransactionFilters,
  type TransactionStatus,
  type TransactionTypeFilter,
} from "../schemas";
import { QuickExpenseDialog } from "./quick-expense-dialog";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { TransactionsTable } from "./transactions-table";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

interface LancamentosWorkspaceProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  spaces: SidebarSpace[];
  contacts: ContactRow[];
  initialMonth: string;
  initialRows: TransactionRow[];
  initialTotals: TransactionTotals;
}

/** Página `/financas/lancamentos` (4.4): tabela + filtros + totais + criação + "Gasto rápido". */
export function LancamentosWorkspace({ accounts, categories, spaces, contacts, initialMonth, initialRows, initialTotals }: LancamentosWorkspaceProps) {
  const [month, setMonth] = useState(initialMonth);
  const [accountId, setAccountId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [contactId, setContactId] = useState("");
  const [type, setType] = useState<TransactionTypeFilter | "">("");
  const [status, setStatus] = useState<TransactionStatus | "">("");
  const [text, setText] = useState("");
  const [noCategory, setNoCategory] = useState(false);

  const [rows, setRows] = useState(initialRows);
  const [totals, setTotals] = useState(initialTotals);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [isPending, startTransition] = useTransition();

  const period = useMemo(() => monthPeriod(month), [month]);

  function currentFilters(): TransactionFilters {
    return {
      periodStart: period.start,
      periodEnd: period.end,
      accountId: accountId || undefined,
      spaceId: spaceId || undefined,
      categoryId: categoryId || undefined,
      contactId: contactId || undefined,
      type: type || undefined,
      status: status || undefined,
      text: text || undefined,
      noCategory: noCategory || undefined,
    };
  }

  function reload() {
    startTransition(async () => {
      const result = await searchTransactions(currentFilters());
      setRows(result.rows);
      setTotals(result.totals);
    });
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const result = await searchTransactions(currentFilters());
        setRows(result.rows);
        setTotals(result.totals);
        setSelected(new Set());
      });
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `currentFilters`/`period` derivam só das próprias dependências abaixo.
  }, [month, accountId, spaceId, categoryId, contactId, type, status, text, noCategory]);

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const contactNameById = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  const categoryLabelById = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const map = new Map<string, string>();
    for (const c of categories) {
      const parent = c.parentId ? byId.get(c.parentId) : null;
      map.set(c.id, parent ? `${parent.name} › ${c.name}` : c.name);
    }
    return map;
  }, [categories]);

  function handleChangeCategory(id: string, newCategoryId: string | null) {
    const row = rows.find((r) => r.id === id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, categoryId: newCategoryId } : r)));
    startTransition(async () => {
      const result = await updateTransactionCategory(id, newCategoryId);
      if (!result.ok) {
        toast.error(result.error);
        reload();
        return;
      }
      // "Aprender com correções" (4.6): só oferece pra lançamento importado (`import_id`), onde a descrição crua do banco tende a se repetir.
      if (newCategoryId && row?.importId) offerLearnRule(row.description, newCategoryId);
    });
  }

  function offerLearnRule(description: string, categoryId: string) {
    const pattern = normalizeDescription(description);
    if (!pattern) return;
    const categoryName = categoryLabelById.get(categoryId) ?? "esta categoria";
    toast(`Sempre categorizar "${pattern}" como ${categoryName}?`, {
      duration: 15000,
      action: {
        label: "Criar regra",
        onClick: () => {
          startTransition(async () => {
            const result = await createRule({ matchField: "description", matchType: "contains", pattern, setCategoryId: categoryId, priority: 100 });
            if (!result.ok) toast.error(result.error);
            else toast.success("Regra criada — próximos lançamentos parecidos já chegam categorizados.");
          });
        },
      },
    });
  }

  function handleChangeDescription(id: string, description: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, description } : r)));
    startTransition(async () => {
      const result = await updateTransactionDescription(id, description);
      if (!result.ok) {
        toast.error(result.error);
        reload();
      }
    });
  }

  function handleDelete(row: TransactionRow, scope: "this" | "future") {
    const message =
      row.kind === "transfer" ? "Excluir esta transferência (as duas pernas)?" : scope === "future" ? "Excluir esta parcela e as próximas?" : "Excluir este lançamento?";
    if (!window.confirm(message)) return;

    startTransition(async () => {
      const result = await deleteTransaction(row.id, scope);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Excluído.");
      reload();
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  function handleBulkCategorize() {
    if (!bulkCategoryId || selected.size === 0) return;
    const ids = [...selected];
    startTransition(async () => {
      const result = await bulkCategorizeTransactions({ ids, categoryId: bulkCategoryId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((prev) => prev.map((r) => (selected.has(r.id) ? { ...r, categoryId: bulkCategoryId } : r)));
      toast.success(`${ids.length} lançamento(s) categorizado(s).`);
      setSelected(new Set());
      setBulkCategoryId("");
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Lançamentos</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financas"
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <LayoutDashboard className="h-4 w-4" /> Painel
          </Link>
          <Link
            href="/financas/configurar"
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <Settings className="h-4 w-4" /> Configurar
          </Link>
          <Link
            href="/financas/contas"
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <Receipt className="h-4 w-4" /> Contas
          </Link>
          <Link
            href="/financas/orcamento"
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <PiggyBank className="h-4 w-4" /> Orçamento
          </Link>
          <Link
            href="/financas/regras"
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <Filter className="h-4 w-4" /> Regras
          </Link>
          <Link
            href="/financas/importar"
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <Upload className="h-4 w-4" /> Importar extrato
          </Link>
          <button
            type="button"
            onClick={() => setShowQuick(true)}
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <Zap className="h-4 w-4" /> Gasto rápido
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium">
            <Plus className="h-4 w-4" /> Novo lançamento
          </button>
        </div>
      </div>

      {accounts.length === 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Nenhuma conta cadastrada ainda.{" "}
          <Link href="/financas/configurar" className="underline">
            Cadastre uma conta
          </Link>{" "}
          antes de lançar.
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior" className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-40 text-center text-sm font-medium text-black dark:text-zinc-50">{period.label}</span>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês" className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ChevronRight className="h-5 w-5" />
        </button>
        {month !== initialMonth && (
          <button type="button" onClick={() => setMonth(initialMonth)} className="text-xs text-zinc-400 hover:underline dark:text-zinc-500">
            Mês atual
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Entradas</p>
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(totals.incomeCents)}</p>
        </div>
        <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Saídas</p>
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">{formatBRL(totals.expenseCents)}</p>
        </div>
        <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Resultado</p>
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{formatBRL(totals.resultCents)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar descrição…" className={`${inputClassName} min-w-48 flex-1`} />
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClassName}>
          <option value="">Toda conta</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={inputClassName}>
          <option value="">Todo espaço</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClassName} disabled={noCategory}>
          <option value="">Toda categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabelById.get(c.id) ?? c.name}
            </option>
          ))}
        </select>
        <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClassName}>
          <option value="">Todo contato</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as TransactionTypeFilter | "")} className={inputClassName}>
          <option value="">Todo tipo</option>
          {TRANSACTION_TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>
              {TRANSACTION_TYPE_FILTER_LABELS[t]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus | "")} className={inputClassName}>
          <option value="">Todo status</option>
          {TRANSACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRANSACTION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={noCategory}
            onChange={(e) => {
              setNoCategory(e.target.checked);
              if (e.target.checked) setCategoryId("");
            }}
          />
          Sem categoria
        </label>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-black/[.08] bg-black/[.02] p-2 dark:border-white/[.08] dark:bg-white/[.03]">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">{selected.size} selecionado(s)</span>
          <select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)} className={inputClassName}>
            <option value="">Categorizar como…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabelById.get(c.id) ?? c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkCategorize}
            disabled={!bulkCategoryId}
            className="bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            Aplicar
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-zinc-500 hover:underline">
            Cancelar seleção
          </button>
        </div>
      )}

      <TransactionsTable
        rows={rows}
        accountNameById={accountNameById}
        categories={categories}
        categoryLabelById={categoryLabelById}
        contactNameById={contactNameById}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onChangeCategory={handleChangeCategory}
        onChangeDescription={handleChangeDescription}
        onDelete={handleDelete}
        pending={isPending}
      />

      {showForm && (
        <TransactionFormDialog
          accounts={accounts}
          categories={categories}
          spaces={spaces}
          contacts={contacts}
          defaultOccurredOn={today}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      {showQuick && (
        <QuickExpenseDialog
          accounts={accounts}
          categories={categories}
          defaultAccountId={accounts[0]?.id ?? ""}
          defaultOccurredOn={today}
          onClose={() => setShowQuick(false)}
          onCreated={() => {
            setShowQuick(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
