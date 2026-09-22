"use client";

import { Copy, Plus, Repeat, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import { ChargeLinkDialog } from "@/features/sharing/components/charge-link-dialog";
import type { SidebarSpace } from "@/features/spaces/queries";
import { formatBRL } from "@/lib/money";
import { cancelBill, searchBills } from "../actions";
import { BILL_GROUP_KEYS, BILL_GROUP_LABELS, groupBillsByDueDate } from "../lib/bill-groups";
import type { AccountRow, BillRow, CategoryRow } from "../queries";
import { BILL_DIRECTION_LABELS, BILL_STATUS_LABELS, BILL_TABS, type BillTab } from "../schemas";
import { BillFormDialog } from "./bill-form-dialog";
import { MarkBillPaidDialog } from "./mark-bill-paid-dialog";

const TAB_LABELS: Record<BillTab, string> = {
  payable: "A pagar",
  receivable: "A receber",
  paid: "Pagas",
  all: "Todas",
};

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

interface BillsWorkspaceProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  spaces: SidebarSpace[];
  contacts: ContactRow[];
  initialToday: string;
  initialRows: BillRow[];
}

/** Página `/financas/contas` (4.8): abas + agrupamento por vencimento, criar/editar/cancelar, marcar como paga/recebida. */
export function BillsWorkspace({ accounts, categories, spaces, contacts, initialToday, initialRows }: BillsWorkspaceProps) {
  const [tab, setTab] = useState<BillTab>("payable");
  const [rows, setRows] = useState(initialRows);
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<BillRow | null>(null);
  const [payingBill, setPayingBill] = useState<BillRow | null>(null);
  const [chargingBill, setChargingBill] = useState<BillRow | null>(null);
  const [, startTransition] = useTransition();

  const today = initialToday;

  const contactNameById = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  const contactPhoneById = useMemo(() => new Map(contacts.map((c) => [c.id, c.phoneE164])), [contacts]);
  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryLabelById = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const map = new Map<string, string>();
    for (const c of categories) {
      const parent = c.parentId ? byId.get(c.parentId) : null;
      map.set(c.id, parent ? `${parent.name} › ${c.name}` : c.name);
    }
    return map;
  }, [categories]);

  function reload(nextTab: BillTab = tab) {
    startTransition(async () => {
      const result = await searchBills({ tab: nextTab });
      setRows(result);
    });
  }

  function handleChangeTab(nextTab: BillTab) {
    setTab(nextTab);
    reload(nextTab);
  }

  function handleCancel(bill: BillRow) {
    if (!window.confirm(`Cancelar "${bill.description}"?`)) return;
    startTransition(async () => {
      const result = await cancelBill(bill.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta cancelada.");
      reload();
    });
  }

  const groups = tab === "payable" || tab === "receivable" ? groupBillsByDueDate(rows, today) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Contas a pagar e receber</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financas/recorrencias"
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <Repeat className="h-4 w-4" /> Recorrências
          </Link>
          <Link
            href="/financas/dividir"
            className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-4 py-1.5 text-sm font-medium dark:border-white/[.16]"
          >
            <Users className="h-4 w-4" /> Dividir
          </Link>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Nova conta
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-black/[.04] p-1 dark:bg-white/[.06]">
        {BILL_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleChangeTab(t)}
            className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {rows.length === 0 && <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma conta aqui.</p>}

      {groups
        ? BILL_GROUP_KEYS.map((key) =>
            groups[key].length === 0 ? null : (
              <div key={key} className="flex flex-col gap-2">
                <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{BILL_GROUP_LABELS[key]}</h2>
                <div className="flex flex-col gap-2">
                  {groups[key].map((bill) => (
                    <BillCard
                      key={bill.id}
                      bill={bill}
                      contactName={bill.contactId ? contactNameById.get(bill.contactId) : undefined}
                      accountName={bill.accountId ? accountNameById.get(bill.accountId) : undefined}
                      categoryLabel={bill.categoryId ? categoryLabelById.get(bill.categoryId) : undefined}
                      onEdit={() => setEditingBill(bill)}
                      onPay={() => setPayingBill(bill)}
                      onCancel={() => handleCancel(bill)}
                      onCharge={() => setChargingBill(bill)}
                    />
                  ))}
                </div>
              </div>
            ),
          )
        : rows.length > 0 && (
            <div className="flex flex-col gap-2">
              {rows.map((bill) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  contactName={bill.contactId ? contactNameById.get(bill.contactId) : undefined}
                  accountName={bill.accountId ? accountNameById.get(bill.accountId) : undefined}
                  categoryLabel={bill.categoryId ? categoryLabelById.get(bill.categoryId) : undefined}
                  onEdit={() => setEditingBill(bill)}
                  onPay={() => setPayingBill(bill)}
                  onCancel={() => handleCancel(bill)}
                  onCharge={() => setChargingBill(bill)}
                />
              ))}
            </div>
          )}

      {showForm && (
        <BillFormDialog
          accounts={accounts}
          categories={categories}
          spaces={spaces}
          contacts={contacts}
          defaultDueOn={today}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      {editingBill && (
        <BillFormDialog
          bill={editingBill}
          accounts={accounts}
          categories={categories}
          spaces={spaces}
          contacts={contacts}
          defaultDueOn={today}
          onClose={() => setEditingBill(null)}
          onSaved={() => {
            setEditingBill(null);
            reload();
          }}
        />
      )}

      {payingBill && (
        <MarkBillPaidDialog
          bill={payingBill}
          accounts={accounts}
          onClose={() => setPayingBill(null)}
          onPaid={() => {
            setPayingBill(null);
            reload();
          }}
        />
      )}

      {chargingBill && (
        <ChargeLinkDialog
          resourceType="bill"
          resourceId={chargingBill.id}
          title={chargingBill.description}
          amountCents={chargingBill.amountCents - chargingBill.paidCents}
          contactName={chargingBill.contactId ? (contactNameById.get(chargingBill.contactId) ?? null) : null}
          contactPhone={chargingBill.contactId ? (contactPhoneById.get(chargingBill.contactId) ?? null) : null}
          hasAttachment={chargingBill.attachmentId != null}
          showFullSplitOption={false}
          onClose={() => setChargingBill(null)}
        />
      )}
    </div>
  );
}

function BillCard({
  bill,
  contactName,
  accountName,
  categoryLabel,
  onEdit,
  onPay,
  onCancel,
  onCharge,
}: {
  bill: BillRow;
  contactName: string | undefined;
  accountName: string | undefined;
  categoryLabel: string | undefined;
  onEdit: () => void;
  onPay: () => void;
  onCancel: () => void;
  onCharge: () => void;
}) {
  const canPay = bill.status === "open" || bill.status === "partial";
  const canCancel = bill.status !== "canceled" && bill.status !== "paid";
  const canCharge = bill.direction === "receivable" && canPay;
  const amountColor = bill.direction === "payable" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-black dark:text-zinc-50">{bill.description}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {BILL_DIRECTION_LABELS[bill.direction]} · vence {bill.dueOn}
            {contactName ? ` · ${contactName}` : ""}
            {categoryLabel ? ` · ${categoryLabel}` : ""}
            {accountName ? ` · ${accountName}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold ${amountColor}`}>{formatBRL(bill.amountCents)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {bill.overdue ? "Atrasada" : BILL_STATUS_LABELS[bill.status]}
            {bill.status === "partial" ? ` (${formatBRL(bill.paidCents)} pago)` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {canPay && (
          <button type="button" onClick={onPay} className="text-black underline dark:text-zinc-50">
            {bill.direction === "payable" ? "Marcar como paga" : "Marcar como recebida"}
          </button>
        )}
        {canCharge && (
          <button type="button" onClick={onCharge} className="text-black underline dark:text-zinc-50">
            Cobrar
          </button>
        )}
        <button type="button" onClick={onEdit} className="text-zinc-600 underline dark:text-zinc-300">
          Editar
        </button>
        {canCancel && (
          <button type="button" onClick={onCancel} className="text-zinc-500 underline dark:text-zinc-400">
            Cancelar
          </button>
        )}
        {bill.barcode && (
          <button type="button" onClick={() => copyToClipboard(bill.barcode!, "Linha digitável")} className="flex items-center gap-1 text-zinc-500 underline dark:text-zinc-400">
            <Copy className="h-3 w-3" /> Linha digitável
          </button>
        )}
        {bill.pixCode && (
          <button type="button" onClick={() => copyToClipboard(bill.pixCode!, "Pix copia e cola")} className="flex items-center gap-1 text-zinc-500 underline dark:text-zinc-400">
            <Copy className="h-3 w-3" /> Pix
          </button>
        )}
      </div>
    </div>
  );
}
