"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AttachmentUploader } from "@/features/attachments/components/attachment-uploader";
import type { AttachmentRow } from "@/features/attachments/queries";
import type { ContactRow } from "@/features/contacts/queries";
import { formatBRL, parseBRL } from "@/lib/money";
import { createSplit } from "../actions";
import type { AccountRow, CategoryRow, LinkableTransactionRow } from "../queries";
import { SPLIT_METHOD_LABELS, type CreateSplitInput, type SplitOriginMode } from "../schemas";
import { SPLIT_METHODS, type SplitMethod } from "../lib/split-shares";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

/** Sentinela local do "Eu" na lista de participantes — nunca colide com um `contact_id` (uuid). */
const ME_ID = "__eu__";

function parseLenient(value: string): number | null {
  if (!value.trim()) return null;
  try {
    return parseBRL(value);
  } catch {
    return null;
  }
}

interface SplitFormDialogProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  contacts: ContactRow[];
  linkableTransactions: LinkableTransactionRow[];
  defaultOccurredOn: string;
  onClose: () => void;
  onSaved: () => void;
}

/** "Nova divisão" (4.9): igual/exato/porcentagem/cotas, com diferença em tempo real, e origem opcional da transação. */
export function SplitFormDialog({ accounts, categories, contacts, linkableTransactions, defaultOccurredOn, onClose, onSaved }: SplitFormDialogProps) {
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [paidByContactId, setPaidByContactId] = useState(""); // "" = eu
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [participantIds, setParticipantIds] = useState<string[]>([ME_ID]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [originMode, setOriginMode] = useState<SplitOriginMode>("none");
  const [linkTransactionId, setLinkTransactionId] = useState("");
  const [createAccountId, setCreateAccountId] = useState("");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [groupLabel, setGroupLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const iPaid = !paidByContactId;

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const totalCents = parseLenient(totalAmount) ?? 0;
  const exactSumCents = method === "exact" ? participantIds.reduce((sum, id) => sum + (parseLenient(values[id] ?? "") ?? 0), 0) : 0;
  const exactDiffCents = totalCents - exactSumCents;
  const percentSum = method === "percent" ? participantIds.reduce((sum, id) => sum + (Number(weights[id]) || 0), 0) : 0;

  function handleSubmit() {
    setFieldErrors({});

    const payload: CreateSplitInput = {
      title,
      totalAmount,
      occurredOn,
      paidByContactId: paidByContactId || undefined,
      method,
      participants: participantIds.map((id) => ({
        contactId: id === ME_ID ? null : id,
        value: values[id],
        weight: weights[id] ? Number(weights[id]) : undefined,
      })),
      originMode,
      linkTransactionId: originMode === "link" ? linkTransactionId || undefined : undefined,
      createAccountId: originMode === "create" ? createAccountId || undefined : undefined,
      createCategoryId: originMode === "create" ? createCategoryId || undefined : undefined,
      attachmentId: attachmentId || undefined,
      groupLabel: groupLabel.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    startTransition(async () => {
      const result = await createSplit(payload);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Divisão criada.");
      onSaved();
    });
  }

  const canSubmit = title.trim() && totalAmount.trim() && participantIds.length > 0 && (method !== "exact" || exactDiffCents === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Nova divisão</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <label className={labelClassName}>
          Título*
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Jantar, aluguel, viagem…" className={inputClassName} disabled={pending} />
          {fieldErrors.title && <span className="text-red-500">{fieldErrors.title[0]}</span>}
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Valor total*
            <input value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
            {fieldErrors.totalAmount && <span className="text-red-500">{fieldErrors.totalAmount[0]}</span>}
          </label>
          <label className={labelClassName}>
            Data
            <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className={inputClassName} disabled={pending} />
          </label>
        </div>

        <label className={labelClassName}>
          Quem pagou
          <select value={paidByContactId} onChange={(e) => setPaidByContactId(e.target.value)} className={inputClassName} disabled={pending}>
            <option value="">Eu</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname || c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-1 rounded-lg bg-black/[.04] p-1 dark:bg-white/[.06]">
          {SPLIT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              disabled={pending}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                method === m ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {SPLIT_METHOD_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Participantes*</span>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={participantIds.includes(ME_ID)} onChange={() => toggleParticipant(ME_ID)} disabled={pending} />
            Eu
            {method === "exact" && participantIds.includes(ME_ID) && (
              <input
                value={values[ME_ID] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [ME_ID]: e.target.value }))}
                placeholder="0,00"
                className={`${inputClassName} ml-auto w-28`}
                disabled={pending}
              />
            )}
            {(method === "percent" || method === "shares") && participantIds.includes(ME_ID) && (
              <input
                type="number"
                min={0}
                value={weights[ME_ID] ?? ""}
                onChange={(e) => setWeights((w) => ({ ...w, [ME_ID]: e.target.value }))}
                placeholder={method === "percent" ? "%" : "cotas"}
                className={`${inputClassName} ml-auto w-20`}
                disabled={pending}
              />
            )}
          </label>
          {contacts.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={participantIds.includes(c.id)} onChange={() => toggleParticipant(c.id)} disabled={pending} />
              {c.nickname || c.name}
              {method === "exact" && participantIds.includes(c.id) && (
                <input
                  value={values[c.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                  placeholder="0,00"
                  className={`${inputClassName} ml-auto w-28`}
                  disabled={pending}
                />
              )}
              {(method === "percent" || method === "shares") && participantIds.includes(c.id) && (
                <input
                  type="number"
                  min={0}
                  value={weights[c.id] ?? ""}
                  onChange={(e) => setWeights((w) => ({ ...w, [c.id]: e.target.value }))}
                  placeholder={method === "percent" ? "%" : "cotas"}
                  className={`${inputClassName} ml-auto w-20`}
                  disabled={pending}
                />
              )}
            </label>
          ))}
          {fieldErrors.participants && <span className="text-xs text-red-500">{fieldErrors.participants[0]}</span>}

          {method === "exact" && (
            <p className={`text-xs ${exactDiffCents === 0 ? "text-zinc-400 dark:text-zinc-500" : "text-red-600 dark:text-red-400"}`}>
              {exactDiffCents === 0 ? "A soma bate com o total." : `Diferença: ${formatBRL(exactDiffCents, { sign: true })} (soma ${formatBRL(exactSumCents)} de ${formatBRL(totalCents)})`}
            </p>
          )}
          {method === "percent" && (
            <p className={`text-xs ${Math.abs(percentSum - 100) <= 0.01 ? "text-zinc-400 dark:text-zinc-500" : "text-red-600 dark:text-red-400"}`}>Soma: {percentSum}% (precisa ser 100%)</p>
          )}
        </div>

        <label className={labelClassName}>
          Grupo
          <input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} placeholder="Ex.: Viagem Floripa (opcional)" className={inputClassName} disabled={pending} />
        </label>

        {iPaid && (
          <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
            <label className={labelClassName}>
              Lançamento do total
              <select value={originMode} onChange={(e) => setOriginMode(e.target.value as SplitOriginMode)} className={inputClassName} disabled={pending}>
                <option value="none">Nenhum (só registrar a divisão)</option>
                <option value="create">Criar a transação da minha despesa total</option>
                <option value="link">Vincular a um lançamento existente</option>
              </select>
            </label>

            {originMode === "create" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClassName}>
                  Conta*
                  <select value={createAccountId} onChange={(e) => setCreateAccountId(e.target.value)} className={inputClassName} disabled={pending}>
                    <option value="">Selecione</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.createAccountId && <span className="text-red-500">{fieldErrors.createAccountId[0]}</span>}
                </label>
                <label className={labelClassName}>
                  Categoria
                  <select value={createCategoryId} onChange={(e) => setCreateCategoryId(e.target.value)} className={inputClassName} disabled={pending}>
                    <option value="">Sem categoria</option>
                    {categories
                      .filter((c) => c.kind === "expense")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}

            {originMode === "link" && (
              <label className={labelClassName}>
                Lançamento*
                <select value={linkTransactionId} onChange={(e) => setLinkTransactionId(e.target.value)} className={inputClassName} disabled={pending}>
                  <option value="">Selecione</option>
                  {linkableTransactions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.occurredOn} · {t.description} · {formatBRL(t.amountCents)}
                    </option>
                  ))}
                </select>
                {fieldErrors.linkTransactionId && <span className="text-red-500">{fieldErrors.linkTransactionId[0]}</span>}
                {linkableTransactions.length === 0 && <span className="font-normal text-zinc-400">Nenhuma despesa recente sem divisão pra vincular.</span>}
              </label>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Anexar recibo</span>
          <AttachmentUploader itemId={null} onUploaded={(a: AttachmentRow) => setAttachmentId(a.id)} />
        </div>

        <label className={labelClassName}>
          Observações
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClassName} disabled={pending} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={pending || !canSubmit} className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60">
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
