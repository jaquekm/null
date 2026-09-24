"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { cancelSubscription, createSubscription, deleteSubscription } from "../actions";
import { computeSubscriptionSavings } from "../lib/subscription-savings";
import type { SubscriptionRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function SubscriptionsSection({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [replacedInPhase, setReplacedInPhase] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const savings = computeSubscriptionSavings(subscriptions);

  function resetForm() {
    setName("");
    setMonthlyCost("");
    setReplacedInPhase("");
    setFieldErrors({});
  }

  function handleCreate() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createSubscription({ name, monthlyCost, replacedInPhase: replacedInPhase || undefined });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Assinatura cadastrada.");
      resetForm();
      setShowForm(false);
      router.refresh();
    });
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      const result = await cancelSubscription(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Marcada como cancelada — a economia entra a partir deste mês.");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSubscription(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Assinaturas substituídas</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">O que o Hub substitui — marque como cancelada quando cancelar de verdade.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08] sm:grid-cols-3">
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Economia realizada/mês</div>
          <div className="font-semibold text-black dark:text-zinc-50">{formatBRL(savings.realizedMonthlyCents)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Potencial (ainda pagando)/mês</div>
          <div className="font-semibold text-black dark:text-zinc-50">{formatBRL(savings.pendingMonthlyCents)}</div>
        </div>
      </div>

      {subscriptions.length > 0 && (
        <ul className="flex flex-col gap-1">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <div className="flex flex-col">
                <span className="font-medium text-black dark:text-zinc-50">
                  {sub.name}
                  {sub.canceledAt ? (
                    <span className="ml-2 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-normal text-green-700 dark:text-green-400">Cancelada</span>
                  ) : (
                    <span className="ml-2 rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-normal dark:bg-white/[.1]">Ainda pagando</span>
                  )}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatBRL(sub.monthlyCostCents)}/mês{sub.replacedInPhase ? ` · Fase ${sub.replacedInPhase}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                {!sub.canceledAt && (
                  <button type="button" onClick={() => handleCancel(sub.id)} disabled={pending} className="text-zinc-500 hover:underline disabled:opacity-60">
                    Marcar cancelada
                  </button>
                )}
                <button type="button" onClick={() => handleDelete(sub.id)} disabled={pending} className="text-red-500 hover:underline disabled:opacity-60">
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={labelClassName}>
              Nome*
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Notion, Evernote..." className={inputClassName} disabled={pending} />
              {fieldErrors.name && <span className="text-red-500">{fieldErrors.name[0]}</span>}
            </label>
            <label className={labelClassName}>
              Valor mensal*
              <input value={monthlyCost} onChange={(e) => setMonthlyCost(e.target.value)} placeholder="R$ 29,90" className={inputClassName} disabled={pending} />
              {fieldErrors.monthlyCost && <span className="text-red-500">{fieldErrors.monthlyCost[0]}</span>}
            </label>
            <label className={labelClassName}>
              Fase que substitui
              <input value={replacedInPhase} onChange={(e) => setReplacedInPhase(e.target.value)} placeholder="3.3" className={inputClassName} disabled={pending} />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending || !name.trim() || !monthlyCost.trim()}
              className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Cadastrar"}
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
          + Nova assinatura
        </button>
      )}
    </section>
  );
}
