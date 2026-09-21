"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { formatBRL } from "@/lib/money";
import { archiveAccount, createAccount } from "../actions";
import type { AccountRow } from "../queries";
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABELS, type AccountKind } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function AccountSection({ accounts, spaces }: { accounts: AccountRow[]; spaces: SidebarSpace[] }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("checking");
  const [institution, setInstitution] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [creditLimit, setCreditLimit] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function resetForm() {
    setName("");
    setKind("checking");
    setInstitution("");
    setSpaceId("");
    setOpeningBalance("");
    setOpeningDate(new Date().toISOString().slice(0, 10));
    setCreditLimit("");
    setClosingDay("");
    setDueDay("");
    setPaymentAccountId("");
    setFieldErrors({});
  }

  function handleCreate() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createAccount({
        name,
        kind,
        institution: institution || undefined,
        spaceId: spaceId || undefined,
        openingBalance,
        openingDate,
        creditLimit: creditLimit || undefined,
        closingDay: closingDay ? Number(closingDay) : undefined,
        dueDay: dueDay ? Number(dueDay) : undefined,
        paymentAccountId: paymentAccountId || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Conta criada.");
      resetForm();
      setShowForm(false);
      router.refresh();
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archiveAccount(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">1. Contas</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Nome, tipo, instituição, espaço, saldo inicial e data. Para cartões: limite, fechamento, vencimento e conta pagadora.</p>

      {accounts.length > 0 && (
        <ul className="flex flex-col gap-1">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <div className="flex flex-col">
                <span className="font-medium text-black dark:text-zinc-50">{account.name}</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {ACCOUNT_KIND_LABELS[account.kind]} · {formatBRL(account.openingBalanceCents)}
                </span>
              </div>
              <button type="button" onClick={() => handleArchive(account.id)} disabled={pending} className="text-xs text-red-500 hover:underline disabled:opacity-60">
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Nome*
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} disabled={pending} />
              {fieldErrors.name && <span className="text-red-500">{fieldErrors.name[0]}</span>}
            </label>
            <label className={labelClassName}>
              Tipo
              <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)} className={inputClassName} disabled={pending}>
                {ACCOUNT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ACCOUNT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Instituição
              <input value={institution} onChange={(e) => setInstitution(e.target.value)} className={inputClassName} disabled={pending} />
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
            <label className={labelClassName}>
              Saldo inicial*
              <input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
              {fieldErrors.openingBalance && <span className="text-red-500">{fieldErrors.openingBalance[0]}</span>}
            </label>
            <label className={labelClassName}>
              Data do saldo inicial
              <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className={inputClassName} disabled={pending} />
            </label>
          </div>

          {kind === "credit_card" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClassName}>
                Limite
                <input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
                {fieldErrors.creditLimit && <span className="text-red-500">{fieldErrors.creditLimit[0]}</span>}
              </label>
              <label className={labelClassName}>
                Dia de fechamento
                <input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className={inputClassName} disabled={pending} />
              </label>
              <label className={labelClassName}>
                Dia de vencimento
                <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputClassName} disabled={pending} />
              </label>
              <label className={labelClassName}>
                Conta pagadora
                <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={inputClassName} disabled={pending}>
                  <option value="">Nenhuma</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending || !name.trim() || !openingBalance.trim()}
              className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Criar conta"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={pending}
              className="self-start rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="self-start text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          + Nova conta
        </button>
      )}
    </div>
  );
}
