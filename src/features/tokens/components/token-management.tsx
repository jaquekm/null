"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { createToken, revokeToken, type CreatedToken, type CreateTokenState } from "../actions";
import type { ApiTokenRow } from "../queries";
import { AVAILABLE_SCOPES, SCOPE_LABELS, TOKEN_VALIDITY_OPTIONS, UPCOMING_SCOPES, type TokenValidity } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

/** Estado inicial do `useActionState` — mora aqui (componente cliente), não em `actions.ts`: um arquivo `"use server"` só pode exportar funções async, nunca um valor como este (erro em runtime no Next.js, quebrava esta página inteira em produção). */
const initialCreateTokenState: CreateTokenState = { ok: true, data: null };

export function TokenManagement({ tokens: initialTokens }: { tokens: ApiTokenRow[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [revealed, setRevealed] = useState<CreatedToken | null>(null);

  function handleCreated(token: CreatedToken) {
    setTokens((current) => [
      {
        id: token.id,
        name: token.name,
        prefix: token.prefix,
        scopes: token.scopes,
        lastUsedAt: null,
        expiresAt: token.expiresAt,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setRevealed(token);
  }

  function handleRevoked(id: string) {
    setTokens((current) => current.map((t) => (t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t)));
  }

  return (
    <div className="flex flex-col gap-6">
      {revealed && <RevealedTokenBanner token={revealed} onDismiss={() => setRevealed(null)} />}
      <CreateTokenForm onCreated={handleCreated} />
      <TokenList tokens={tokens} onRevoked={handleRevoked} />
    </div>
  );
}

function RevealedTokenBanner({ token, onDismiss }: { token: CreatedToken; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token.token);
      setCopied(true);
      toast.success("Token copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm font-medium text-black dark:text-zinc-50">
        Token &ldquo;{token.name}&rdquo; criado — copie agora, ele não será mostrado de novo.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-lg bg-black/[.04] px-2.5 py-1.5 text-xs dark:bg-white/[.06]">{token.token}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <button type="button" onClick={onDismiss} className="self-start text-xs text-zinc-500 hover:underline dark:text-zinc-400">
        Já copiei, fechar
      </button>
    </div>
  );
}

function CreateTokenForm({ onCreated }: { onCreated: (token: CreatedToken) => void }) {
  const [state, formAction, pending] = useActionState(createToken, initialCreateTokenState);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["capture"]);
  const [validity, setValidity] = useState<TokenValidity>("never");

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok && state.data) {
      onCreated(state.data);
      setName("");
      setScopes(["capture"]);
      setValidity("never");
    }
  }

  function toggleScope(scope: string) {
    setScopes((current) => (current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]));
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]"
    >
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Novo token</h2>

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Nome
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Atalho do iOS"
          maxLength={100}
          className={inputClassName}
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm text-zinc-700 dark:text-zinc-300">Escopos</legend>
        {AVAILABLE_SCOPES.map((scope) => (
          <label key={scope} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" name="scopes" value={scope} checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
            {SCOPE_LABELS[scope]}
          </label>
        ))}
        {UPCOMING_SCOPES.map((scope) => (
          <label key={scope} className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-600">
            <input type="checkbox" disabled />
            {scope} <span className="text-xs">(em breve)</span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Validade
        <select
          name="validity"
          value={validity}
          onChange={(e) => setValidity(e.target.value as TokenValidity)}
          className={inputClassName}
        >
          {TOKEN_VALIDITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Criando..." : "Criar token"}
      </button>

      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}

function TokenList({ tokens, onRevoked }: { tokens: ApiTokenRow[]; onRevoked: (id: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  function handleRevoke(id: string, name: string) {
    if (!window.confirm(`Revogar o token "${name}"? Ele para de funcionar imediatamente.`)) return;
    startTransition(async () => {
      const result = await revokeToken(id);
      if (result.ok) onRevoked(id);
      else toast.error(result.error);
    });
  }

  if (tokens.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhum token ainda.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {tokens.map((token) => {
        const revoked = Boolean(token.revokedAt);
        const expired = Boolean(token.expiresAt) && new Date(token.expiresAt as string).getTime() < now;

        return (
          <li
            key={token.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]"
          >
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-black dark:text-zinc-50">{token.name}</span>
                <code className="text-xs text-zinc-500 dark:text-zinc-400">{token.prefix}…</code>
                {revoked && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                    revogado
                  </span>
                )}
                {!revoked && expired && (
                  <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    expirado
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{token.scopes.join(", ")}</span>
                <span>último uso: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString("pt-BR") : "nunca"}</span>
                <span>validade: {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString("pt-BR") : "sem validade"}</span>
              </div>
            </div>
            {!revoked && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRevoke(token.id, token.name)}
                className="text-xs text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
              >
                Revogar
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
