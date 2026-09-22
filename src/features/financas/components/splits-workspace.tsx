"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import { ChargeLinkDialog } from "@/features/sharing/components/charge-link-dialog";
import { formatBRL } from "@/lib/money";
import { cancelSplit, getGroupSettlement, getSplitDetail, searchContactBalances, searchSplits, type GroupSettlementResult } from "../actions";
import { ME } from "../lib/net-balances";
import type { AccountRow, CategoryRow, LinkableTransactionRow, SplitRow, SplitShareRow } from "../queries";
import { SPLIT_METHOD_LABELS, SPLIT_STATUS_LABELS } from "../schemas";
import { RegisterSplitPaymentDialog } from "./register-split-payment-dialog";
import { SplitFormDialog } from "./split-form-dialog";

type SplitTab = "open" | "all";

interface SplitsWorkspaceProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  contacts: ContactRow[];
  linkableTransactions: LinkableTransactionRow[];
  groupLabels: string[];
  defaultOccurredOn: string;
  initialSplits: SplitRow[];
  initialBalances: { contactId: string; balanceCents: number }[];
}

/** `/financas/dividir` (4.9): divisões abertas/histórico, saldos por pessoa, nova divisão, registrar pagamento e visão de acerto por grupo. */
export function SplitsWorkspace({ accounts, categories, contacts, linkableTransactions, groupLabels, defaultOccurredOn, initialSplits, initialBalances }: SplitsWorkspaceProps) {
  const [tab, setTab] = useState<SplitTab>("open");
  const [splits, setSplits] = useState(initialSplits);
  const [balances, setBalances] = useState(initialBalances);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sharesBySplitId, setSharesBySplitId] = useState<Record<string, SplitShareRow[]>>({});
  const [payingShare, setPayingShare] = useState<{ share: SplitShareRow; personName: string | null } | null>(null);
  const [chargingShare, setChargingShare] = useState<{ share: SplitShareRow; splitTitle: string; personName: string; phone: string | null } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState(groupLabels[0] ?? "");
  const [settlement, setSettlement] = useState<GroupSettlementResult | null>(null);
  const [, startTransition] = useTransition();

  const contactNameById = useMemo(() => new Map(contacts.map((c) => [c.id, c.nickname || c.name])), [contacts]);
  const contactPhoneById = useMemo(() => new Map(contacts.map((c) => [c.id, c.phoneE164])), [contacts]);

  function reload(nextTab: SplitTab = tab) {
    startTransition(async () => {
      const [rows, balanceRows] = await Promise.all([searchSplits(nextTab === "open" ? { status: "open" } : {}), searchContactBalances()]);
      setSplits(rows);
      setBalances(balanceRows);
    });
  }

  function handleChangeTab(nextTab: SplitTab) {
    setTab(nextTab);
    reload(nextTab);
  }

  function toggleExpand(split: SplitRow) {
    if (expandedId === split.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(split.id);
    if (sharesBySplitId[split.id]) return;
    startTransition(async () => {
      const detail = await getSplitDetail(split.id);
      if (detail) setSharesBySplitId((prev) => ({ ...prev, [split.id]: detail.shares }));
    });
  }

  function handleCancel(split: SplitRow) {
    if (!window.confirm(`Cancelar a divisão "${split.title}"?`)) return;
    startTransition(async () => {
      const result = await cancelSplit(split.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Divisão cancelada.");
      reload();
    });
  }

  function handleShowSettlement() {
    if (!selectedGroup) return;
    startTransition(async () => {
      setSettlement(await getGroupSettlement(selectedGroup));
    });
  }

  function personLabel(personId: string): string {
    if (personId === ME) return "Eu";
    return contactNameById.get(personId) ?? "Contato removido";
  }

  const nonZeroBalances = balances.filter((b) => b.balanceCents !== 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Dividir contas</h1>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nova divisão
        </button>
      </div>

      {nonZeroBalances.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
          {nonZeroBalances.map((b) => {
            const name = contactNameById.get(b.contactId) ?? "Contato removido";
            return (
              <p key={b.contactId}>
                {b.balanceCents > 0 ? (
                  <>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{name}</span> te deve{" "}
                    <span className="font-medium">{formatBRL(b.balanceCents)}</span>
                  </>
                ) : (
                  <>
                    Você deve <span className="font-medium">{formatBRL(-b.balanceCents)}</span> a{" "}
                    <span className="font-medium text-red-600 dark:text-red-400">{name}</span>
                  </>
                )}
              </p>
            );
          })}
        </div>
      )}

      {groupLabels.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Visão de acerto do grupo</span>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setSettlement(null);
              }}
              className="rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1 text-sm dark:border-white/[.16]"
            >
              {groupLabels.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleShowSettlement} className="text-sm text-black underline dark:text-zinc-50">
              Ver acerto
            </button>
          </div>
          {settlement && (
            <div className="flex flex-col gap-1 text-sm">
              {settlement.transfers.length === 0 ? (
                <p className="text-zinc-500 dark:text-zinc-400">Ninguém deve nada nesse grupo.</p>
              ) : (
                settlement.transfers.map((t, i) => (
                  <p key={i}>
                    <span className="font-medium">{personLabel(t.from)}</span> paga{" "}
                    <span className="font-medium">{formatBRL(t.amountCents)}</span> pra <span className="font-medium">{personLabel(t.to)}</span>
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-black/[.04] p-1 dark:bg-white/[.06]">
        {(["open", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleChangeTab(t)}
            className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {t === "open" ? "Abertas" : "Histórico"}
          </button>
        ))}
      </div>

      {splits.length === 0 && <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma divisão aqui.</p>}

      <div className="flex flex-col gap-2">
        {splits.map((split) => (
          <div key={split.id} className="rounded-lg border border-black/[.08] dark:border-white/[.08]">
            <button type="button" onClick={() => toggleExpand(split)} className="flex w-full items-center justify-between gap-2 p-3 text-left">
              <div className="flex min-w-0 items-center gap-2">
                {expandedId === split.id ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-black dark:text-zinc-50">{split.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {split.occurredOn} · {split.paidByContactId ? `${contactNameById.get(split.paidByContactId) ?? "contato removido"} pagou` : "Eu paguei"} ·{" "}
                    {SPLIT_METHOD_LABELS[split.method]}
                    {split.groupLabel ? ` · ${split.groupLabel}` : ""}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-black dark:text-zinc-50">{formatBRL(split.totalCents)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{SPLIT_STATUS_LABELS[split.status]}</p>
              </div>
            </button>

            {expandedId === split.id && (
              <div className="flex flex-col gap-2 border-t border-black/[.08] p-3 dark:border-white/[.08]">
                {!sharesBySplitId[split.id] && <p className="text-xs text-zinc-400">Carregando partes...</p>}
                {sharesBySplitId[split.id]?.map((share) => {
                  const remaining = share.shareCents - share.settledCents;
                  const personName = share.contactId ? (contactNameById.get(share.contactId) ?? "Contato removido") : "Eu";
                  return (
                    <div key={share.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>{personName}</span>
                      <span className="flex items-center gap-2">
                        {formatBRL(share.shareCents)}
                        {remaining > 0 ? (
                          <>
                            <span className="text-amber-600 dark:text-amber-400">({formatBRL(remaining)} em aberto)</span>
                            {share.contactId && split.paidByContactId == null && (
                              <button
                                type="button"
                                onClick={() =>
                                  setChargingShare({ share, splitTitle: split.title, personName, phone: contactPhoneById.get(share.contactId!) ?? null })
                                }
                                className="text-black underline dark:text-zinc-50"
                              >
                                Cobrar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPayingShare({ share, personName: share.contactId ? personName : null })}
                              className="text-black underline dark:text-zinc-50"
                            >
                              Registrar pagamento
                            </button>
                          </>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">Quitada</span>
                        )}
                      </span>
                    </div>
                  );
                })}
                {split.status !== "canceled" && split.status !== "settled" && (
                  <button type="button" onClick={() => handleCancel(split)} className="self-start text-xs text-zinc-500 underline dark:text-zinc-400">
                    Cancelar divisão
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <SplitFormDialog
          accounts={accounts}
          categories={categories}
          contacts={contacts}
          linkableTransactions={linkableTransactions}
          defaultOccurredOn={defaultOccurredOn}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      {payingShare && (
        <RegisterSplitPaymentDialog
          share={payingShare.share}
          personName={payingShare.personName}
          accounts={accounts}
          onClose={() => setPayingShare(null)}
          onPaid={() => {
            const splitId = payingShare.share.splitId;
            setPayingShare(null);
            setSharesBySplitId((prev) => {
              const rest = { ...prev };
              delete rest[splitId];
              return rest;
            });
            reload();
          }}
        />
      )}

      {chargingShare && (
        <ChargeLinkDialog
          resourceType="split"
          resourceId={chargingShare.share.id}
          title={chargingShare.splitTitle}
          amountCents={chargingShare.share.shareCents - chargingShare.share.settledCents}
          contactName={chargingShare.personName}
          contactPhone={chargingShare.phone}
          hasAttachment={splits.find((s) => s.id === chargingShare.share.splitId)?.attachmentId != null}
          showFullSplitOption
          onClose={() => setChargingShare(null)}
        />
      )}
    </div>
  );
}
