import Link from "next/link";
import { ensureMcpTokenExpiryCheckSchedule, listMcpAuditLog } from "@/features/mcp/queries";
import { serverEnv } from "@/lib/env";
import { requireOwner } from "@/lib/auth";

const codeBlockClassName = "overflow-x-auto rounded-lg bg-black/[.04] p-3 text-xs whitespace-pre dark:bg-white/[.06]";

const STATUS_LABEL: Record<string, string> = { ok: "ok", denied: "negado", error: "erro" };

export default async function McpSettingsPage() {
  const { supabase, user } = await requireOwner();
  const [log] = await Promise.all([listMcpAuditLog(supabase), ensureMcpTokenExpiryCheckSchedule(supabase, user.id)]);
  const mcpUrl = `${serverEnv.APP_URL}/api/mcp`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Servidor MCP</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Deixa clientes compatíveis com MCP (Claude Code, apps do Claude) consultar e, com permissão, criar
          conteúdo no Hub.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">1. Crie um token</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          Em{" "}
          <Link href="/configuracoes/tokens" className="underline">
            /configuracoes/tokens
          </Link>
          , crie um token com o(s) escopo(s) que o cliente MCP vai usar: <code>mcp:read</code> (buscar, ler
          itens, agenda, contatos), <code>mcp:write</code> (criar/editar itens, criar lembretes) e/ou{" "}
          <code>finance:read</code> (resumo e lançamentos financeiros). Tokens com esses escopos exigem
          validade de 30 ou 90 dias — você recebe um aviso por push perto do vencimento.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">2. Conecte o Claude Code</h2>
        <pre className={codeBlockClassName}>{`claude mcp add --transport http hub ${mcpUrl} --header "Authorization: Bearer SEU_TOKEN_AQUI"`}</pre>
        <p className="text-sm text-black/60 dark:text-white/60">
          Para outros clientes MCP (apps do Claude, conectores personalizados), use a mesma URL e o mesmo
          cabeçalho <code>Authorization</code> — confira na documentação de cada cliente qual formato de
          conexão HTTP ele espera.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Últimas chamadas</h2>
        {log.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma chamada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <code className="font-medium text-black dark:text-zinc-50">{entry.tool}</code>
                    <span
                      className={
                        entry.status === "ok"
                          ? "text-xs text-emerald-600 dark:text-emerald-400"
                          : "text-xs text-red-600 dark:text-red-400"
                      }
                    >
                      {STATUS_LABEL[entry.status] ?? entry.status}
                    </span>
                  </div>
                  {entry.resultSummary && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{entry.resultSummary.slice(0, 140)}</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{entry.tokenName ?? "token removido"}</span>
                  <span>{new Date(entry.createdAt).toLocaleString("pt-BR")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
