"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AttachmentUploader } from "@/features/attachments/components/attachment-uploader";
import type { AttachmentRow } from "@/features/attachments/queries";
import type { ContactRow } from "@/features/contacts/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createBill, extractBillDataFromAttachment, updateBill, type BillExtractionResult } from "../actions";
import type { AccountRow, BillRow, CategoryRow } from "../queries";
import { BILL_DIRECTION_LABELS, BILL_DIRECTIONS, TRANSACTION_REPEAT_LABELS, TRANSACTION_REPEAT_OPTIONS, type BillDirection, type TransactionRepeatOption } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

function categoryOptions(categories: CategoryRow[], kind: "income" | "expense") {
  const top = categories.filter((c) => c.kind === kind && !c.parentId);
  return top.map((parent) => ({
    parent,
    children: categories.filter((c) => c.kind === kind && c.parentId === parent.id),
  }));
}

interface BillFormDialogProps {
  bill?: BillRow;
  accounts: AccountRow[];
  categories: CategoryRow[];
  spaces: SidebarSpace[];
  contacts: ContactRow[];
  defaultDueOn: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Formulário "Nova conta"/editar conta (4.8): a pagar/a receber, anexo de boleto com extração por IA (opcional), "Repetir" (só na criação). */
export function BillFormDialog({ bill, accounts, categories, spaces, contacts, defaultDueOn, onClose, onSaved }: BillFormDialogProps) {
  const isEditing = Boolean(bill);
  const [direction, setDirection] = useState<BillDirection>(bill?.direction ?? "payable");
  const [description, setDescription] = useState(bill?.description ?? "");
  const [amount, setAmount] = useState("");
  const [amountIsEstimate, setAmountIsEstimate] = useState(false);
  const [dueOn, setDueOn] = useState(bill?.dueOn ?? defaultDueOn);
  const [contactId, setContactId] = useState(bill?.contactId ?? "");
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? "");
  const [accountId, setAccountId] = useState(bill?.accountId ?? "");
  const [spaceId, setSpaceId] = useState(bill?.spaceId ?? "");
  const [attachmentId, setAttachmentId] = useState<string | null>(bill?.attachmentId ?? null);
  const [barcode, setBarcode] = useState(bill?.barcode ?? "");
  const [pixCode, setPixCode] = useState(bill?.pixCode ?? "");
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [repeat, setRepeat] = useState<TransactionRepeatOption>("none");
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<BillExtractionResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function handleUploaded(attachment: AttachmentRow) {
    setAttachmentId(attachment.id);
    setExtraction(null);
  }

  function handleExtract() {
    if (!attachmentId) return;
    setExtracting(true);
    setExtraction(null);
    startTransition(async () => {
      const result = await extractBillDataFromAttachment(attachmentId);
      setExtracting(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setExtraction(result.data);
    });
  }

  function applyExtraction() {
    if (!extraction) return;
    if (extraction.amount) setAmount(extraction.amount);
    if (extraction.dueOn) setDueOn(extraction.dueOn);
    if (extraction.barcode) setBarcode(extraction.barcode);
    if (extraction.payeeName && !description.trim()) setDescription(extraction.payeeName);
    setExtraction(null);
  }

  function handleSubmit() {
    setFieldErrors({});

    const payload = {
      direction,
      description,
      amount,
      amountIsEstimate,
      dueOn,
      contactId: contactId || undefined,
      categoryId: categoryId || undefined,
      accountId: accountId || undefined,
      spaceId: spaceId || undefined,
      attachmentId: attachmentId || undefined,
      barcode: barcode.trim() || undefined,
      pixCode: pixCode.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    startTransition(async () => {
      const result = isEditing ? await updateBill(bill!.id, payload) : await createBill({ ...payload, repeat });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(isEditing ? "Conta atualizada." : "Conta criada.");
      onSaved();
    });
  }

  const groups = categoryOptions(categories, direction === "payable" ? "expense" : "income");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">{isEditing ? "Editar conta" : "Nova conta"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-black/[.04] p-1 dark:bg-white/[.06]">
          {BILL_DIRECTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              disabled={pending}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                direction === d ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {BILL_DIRECTION_LABELS[d]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-black/[.16] p-3 dark:border-white/[.2]">
          <AttachmentUploader itemId={null} onUploaded={handleUploaded} />
          {attachmentId && (
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || pending}
              className="flex items-center gap-1.5 self-start text-xs text-zinc-600 underline disabled:opacity-60 dark:text-zinc-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {extracting ? "Extraindo..." : "Extrair dados do boleto com IA"}
            </button>
          )}
          {extraction && (
            <div className="flex flex-col gap-1 rounded-lg border border-black/[.08] bg-black/[.02] p-2 text-xs dark:border-white/[.08] dark:bg-white/[.03]">
              <p className="text-zinc-500 dark:text-zinc-400">Sugestão da IA — revise antes de aplicar:</p>
              <p>Valor: {extraction.amount ?? "não encontrado"}</p>
              <p>Vencimento: {extraction.dueOn ?? "não encontrado"}</p>
              <p>Beneficiário: {extraction.payeeName ?? "não encontrado"}</p>
              <p className="truncate">Linha digitável: {extraction.barcode ?? "não encontrada"}</p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={applyExtraction} className="text-black underline dark:text-zinc-50">
                  Usar estes dados
                </button>
                <button type="button" onClick={() => setExtraction(null)} className="text-zinc-500 underline dark:text-zinc-400">
                  Descartar
                </button>
              </div>
            </div>
          )}
        </div>

        <label className={labelClassName}>
          Descrição*
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClassName} disabled={pending} />
          {fieldErrors.description && <span className="text-red-500">{fieldErrors.description[0]}</span>}
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Valor*
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
            {fieldErrors.amount && <span className="text-red-500">{fieldErrors.amount[0]}</span>}
          </label>
          <label className={labelClassName}>
            Vencimento*
            <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputClassName} disabled={pending} />
            {fieldErrors.dueOn && <span className="text-red-500">{fieldErrors.dueOn[0]}</span>}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Contato
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Nenhum</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Categoria
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Sem categoria</option>
              {groups.map(({ parent, children }) => (
                <optgroup key={parent.id} label={parent.name}>
                  <option value={parent.id}>{parent.name}</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Conta prevista
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Nenhuma</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {fieldErrors.accountId && <span className="text-red-500">{fieldErrors.accountId[0]}</span>}
          </label>
          <label className={labelClassName}>
            Espaço
            <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Nenhum</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={labelClassName}>
          Linha digitável
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className={inputClassName} disabled={pending} />
        </label>

        <label className={labelClassName}>
          Pix copia e cola
          <textarea value={pixCode} onChange={(e) => setPixCode(e.target.value)} rows={2} className={inputClassName} disabled={pending} />
        </label>

        {!isEditing && (
          <label className={labelClassName}>
            Repetir
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as TransactionRepeatOption)} className={inputClassName} disabled={pending}>
              {TRANSACTION_REPEAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {TRANSACTION_REPEAT_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        )}

        {!isEditing && repeat !== "none" && (
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={amountIsEstimate} onChange={(e) => setAmountIsEstimate(e.target.checked)} disabled={pending} />
            Valor estimado (ex.: conta de luz) — as próximas contas nascem para confirmar o valor
          </label>
        )}

        <label className={labelClassName}>
          Observações
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClassName} disabled={pending} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !amount.trim() || !description.trim() || !dueOn}
            className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
