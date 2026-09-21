import type { JobHandler } from "../types";

/**
 * Job `close_card_statements` (4.7, diário): fecha faturas cujo `period_end`
 * já passou (`open` → `closed`) e cria/atualiza a `fin_bills` a pagar
 * vinculada por `statement_id`, com o total (soma das transações da fatura,
 * valor absoluto) e o vencimento. `account_id` da conta a pagar é a
 * `payment_account_id` do cartão quando o dono já preencheu (4.3); sem ela,
 * a conta fica em branco, igual ao resto do fluxo de faturas.
 */
export const closeCardStatements: JobHandler = async (job, { supabase }) => {
  const today = new Date().toISOString().slice(0, 10);

  const { data: statements, error } = await supabase
    .from("fin_card_statements")
    .select("id, account_id, due_on")
    .eq("owner_id", job.owner_id)
    .eq("status", "open")
    .lt("period_end", today);
  if (error) return { status: "retry", error: error.message };
  if (!statements || statements.length === 0) return { status: "done", result: { closed: 0 } };

  const accountIds = [...new Set(statements.map((s) => s.account_id))];
  const { data: accounts, error: accountsError } = await supabase.from("fin_accounts").select("id, name, payment_account_id").in("id", accountIds);
  if (accountsError) return { status: "retry", error: accountsError.message };
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  let closed = 0;
  const errors: string[] = [];

  for (const statement of statements) {
    try {
      const { data: transactionRows, error: sumError } = await supabase.from("fin_transactions").select("amount_cents").eq("statement_id", statement.id);
      if (sumError) throw new Error(sumError.message);
      const totalCents = Math.abs((transactionRows ?? []).reduce((sum, row) => sum + row.amount_cents, 0));

      const { error: closeError } = await supabase.from("fin_card_statements").update({ status: "closed" }).eq("id", statement.id);
      if (closeError) throw new Error(closeError.message);

      if (totalCents > 0) {
        const { data: existingBill, error: billReadError } = await supabase.from("fin_bills").select("id").eq("statement_id", statement.id).maybeSingle();
        if (billReadError) throw new Error(billReadError.message);

        if (existingBill) {
          const { error: billUpdateError } = await supabase.from("fin_bills").update({ amount_cents: totalCents, due_on: statement.due_on }).eq("id", existingBill.id);
          if (billUpdateError) throw new Error(billUpdateError.message);
        } else {
          const account = accountById.get(statement.account_id);
          const { error: billInsertError } = await supabase.from("fin_bills").insert({
            owner_id: job.owner_id,
            direction: "payable",
            description: `Fatura ${account?.name ?? "cartão"}`,
            account_id: account?.payment_account_id ?? null,
            amount_cents: totalCents,
            due_on: statement.due_on,
            statement_id: statement.id,
          });
          if (billInsertError) throw new Error(billInsertError.message);
        }
      }

      closed += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Falha ao fechar a fatura ${statement.id}.`);
    }
  }

  if (errors.length > 0) return { status: "retry", error: errors.join("; ") };
  return { status: "done", result: { closed } };
};
