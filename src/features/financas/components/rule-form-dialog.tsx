"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { formatBRL } from "@/lib/money";
import { createRule, testRule, updateRule } from "../actions";
import { RULE_MATCH_FIELDS, RULE_MATCH_TYPES } from "../lib/match-rule";
import type { AccountRow, CategoryRow, RuleRow } from "../queries";
import { RULE_MATCH_FIELD_LABELS, RULE_MATCH_TYPE_LABELS, type RuleInput } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

function categoryGroups(categories: CategoryRow[]) {
  const byKind = (kind: "expense" | "income") => categories.filter((c) => c.kind === kind && !c.parentId).map((parent) => ({ parent, children: categories.filter((c) => c.parentId === parent.id) }));
  return { despesas: byKind("expense"), receitas: byKind("income") };
}

/** Prefill do campo (texto BRL editável) a partir do valor salvo — `parseBRL` aceita de volta o que `formatBRL` produz, inclusive com "R$" e sinal. */
function centsToInput(cents: number | null): string {
  return cents == null ? "" : formatBRL(cents);
}

interface RuleFormDialogProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  contacts: ContactRow[];
  spaces: SidebarSpace[];
  initial: RuleRow | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Criar/editar regra de categorização (4.6) — mesmos campos de `fin_rules`, incluindo "Testar nos últimos 90 dias". */
export function RuleFormDialog({ accounts, categories, contacts, spaces, initial, onClose, onSaved }: RuleFormDialogProps) {
  const [matchField, setMatchField] = useState(initial?.matchField ?? "description");
  const [matchType, setMatchType] = useState(initial?.matchType ?? "contains");
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [amountMin, setAmountMin] = useState(() => centsToInput(initial?.amountMinCents ?? null));
  const [amountMax, setAmountMax] = useState(() => centsToInput(initial?.amountMaxCents ?? null));
  const [setCategoryId, setSetCategoryId] = useState(initial?.setCategoryId ?? "");
  const [setContactId, setSetContactId] = useState(initial?.setContactId ?? "");
  const [setDescription, setSetDescription] = useState(initial?.setDescription ?? "");
  const [setSpaceId, setSetSpaceId] = useState(initial?.setSpaceId ?? "");
  const [priority, setPriority] = useState(String(initial?.priority ?? 100));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [testCount, setTestCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [testing, startTestTransition] = useTransition();

  const { despesas, receitas } = categoryGroups(categories);

  function currentInput(): RuleInput {
    return {
      matchField,
      matchType,
      pattern,
      accountId: accountId || undefined,
      amountMin: amountMin || undefined,
      amountMax: amountMax || undefined,
      setCategoryId: setCategoryId || undefined,
      setContactId: setContactId || undefined,
      setDescription: setDescription.trim() || undefined,
      setSpaceId: setSpaceId || undefined,
      priority: Number(priority) || 100,
    };
  }

  function handleTest() {
    setTestCount(null);
    setFieldErrors({});
    startTestTransition(async () => {
      const result = await testRule(currentInput());
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setTestCount(result.data.count);
    });
  }

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = initial ? await updateRule(initial.id, currentInput()) : await createRule(currentInput());
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(initial ? "Regra atualizada." : "Regra criada.");
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">{initial ? "Editar regra" : "Nova regra"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={labelClassName}>
            Campo
            <select value={matchField} onChange={(e) => setMatchField(e.target.value as typeof matchField)} className={inputClassName} disabled={pending}>
              {RULE_MATCH_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {RULE_MATCH_FIELD_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Condição
            <select value={matchType} onChange={(e) => setMatchType(e.target.value as typeof matchType)} className={inputClassName} disabled={pending}>
              {RULE_MATCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RULE_MATCH_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Prioridade
            <input type="number" min={1} max={1000} value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClassName} disabled={pending} />
            <span className="font-normal text-zinc-400">Menor número decide primeiro.</span>
          </label>
        </div>

        <label className={labelClassName}>
          Padrão*
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={matchType === "regex" ? "^UBER" : "uber"}
            className={`${inputClassName} ${matchType === "regex" ? "font-mono" : ""}`}
            disabled={pending}
          />
          {fieldErrors.pattern && <span className="text-red-500">{fieldErrors.pattern[0]}</span>}
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={labelClassName}>
            Conta
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Todas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Valor mínimo
            <input value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="-100,00" className={inputClassName} disabled={pending} />
            {fieldErrors.amountMin && <span className="text-red-500">{fieldErrors.amountMin[0]}</span>}
          </label>
          <label className={labelClassName}>
            Valor máximo
            <input value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="-10,00" className={inputClassName} disabled={pending} />
            {fieldErrors.amountMax && <span className="text-red-500">{fieldErrors.amountMax[0]}</span>}
          </label>
        </div>
        <p className="-mt-2 text-xs text-zinc-400">Valor: entrada positiva, saída negativa (deixe em branco pra não filtrar por valor).</p>

        <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Ao casar, definir:</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Categoria
              <select value={setCategoryId} onChange={(e) => setSetCategoryId(e.target.value)} className={inputClassName} disabled={pending}>
                <option value="">Não definir</option>
                <optgroup label="Despesas">
                  {despesas.map(({ parent, children }) => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name}</option>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </optgroup>
                <optgroup label="Receitas">
                  {receitas.map(({ parent, children }) => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name}</option>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className={labelClassName}>
              Contato
              <select value={setContactId} onChange={(e) => setSetContactId(e.target.value)} className={inputClassName} disabled={pending}>
                <option value="">Não definir</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Espaço
              <select value={setSpaceId} onChange={(e) => setSetSpaceId(e.target.value)} className={inputClassName} disabled={pending}>
                <option value="">Não definir</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Descrição
              <input value={setDescription} onChange={(e) => setSetDescription(e.target.value)} placeholder="Ex.: Uber" className={inputClassName} disabled={pending} />
            </label>
          </div>
          {fieldErrors.setCategoryId && <span className="text-xs text-red-500">{fieldErrors.setCategoryId[0]}</span>}
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={handleTest} disabled={testing || !pattern.trim()} className="rounded-full border border-black/[.12] px-4 py-1.5 text-xs dark:border-white/[.16]">
            {testing ? "Testando..." : "Testar nos últimos 90 dias"}
          </button>
          {testCount !== null && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {testCount} lançamento(s) combinariam com esta regra.
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !pattern.trim()}
            className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
