import { NextResponse } from "next/server";
import { listContacts } from "@/features/contacts/queries";
import { buildTransactionsCsv, type TransactionForCsv } from "@/features/financas/lib/export-csv";
import { listAccounts, listCategories, listTransactions } from "@/features/financas/queries";
import { transactionFiltersSchema } from "@/features/financas/schemas";
import { requireOwner } from "@/lib/auth";

/**
 * "Exportação: lançamentos filtrados em CSV" (4.13) — mesmos filtros de
 * `/financas/lancamentos` (`transactionFiltersSchema`), passados como query
 * string. BOM UTF-8 na frente pra abrir certo no Excel.
 */
export async function GET(request: Request) {
  const { supabase } = await requireOwner();
  const params = new URL(request.url).searchParams;

  const parsed = transactionFiltersSchema.safeParse({
    periodStart: params.get("periodStart") ?? undefined,
    periodEnd: params.get("periodEnd") ?? undefined,
    accountId: params.get("accountId") ?? undefined,
    spaceId: params.get("spaceId") ?? undefined,
    categoryId: params.get("categoryId") ?? undefined,
    contactId: params.get("contactId") ?? undefined,
    type: params.get("type") ?? undefined,
    status: params.get("status") ?? undefined,
    text: params.get("text") ?? undefined,
    noCategory: params.get("noCategory") === "1" ? true : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Filtro inválido." }, { status: 400 });
  }

  const [transactions, categories, accounts, contacts] = await Promise.all([
    listTransactions(supabase, parsed.data),
    listCategories(supabase),
    listAccounts(supabase),
    listContacts(supabase, {}),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const contactNameById = new Map(contacts.map((c) => [c.id, c.name]));

  const rows: TransactionForCsv[] = transactions.map((t) => ({
    occurredOn: t.occurredOn,
    description: t.description,
    amountCents: t.amountCents,
    categoryName: t.categoryId ? (categoryNameById.get(t.categoryId) ?? null) : null,
    accountName: accountNameById.get(t.accountId) ?? "",
    contactName: t.contactId ? (contactNameById.get(t.contactId) ?? null) : null,
    tags: t.tags,
  }));

  const csv = "﻿" + buildTransactionsCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lancamentos-${parsed.data.periodStart}-a-${parsed.data.periodEnd}.csv"`,
    },
  });
}
