"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { createToken, type CreatedToken, type CreateTokenState } from "@/features/tokens/actions";
import { buildBookmarklet } from "../lib/build-bookmarklet";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const codeBlockClassName = "overflow-x-auto rounded-lg bg-black/[.04] p-3 text-xs whitespace-pre dark:bg-white/[.06]";

/** Ver o mesmo comentário em `token-management.tsx`: não pode morar em `actions.ts` (`"use server"` só exporta função async). */
const initialCreateTokenState: CreateTokenState = { ok: true, data: null };

interface TokenOption {
  id: string;
  name: string;
  prefix: string;
}

export function CaptureAutomationSetup({ appUrl, tokens }: { appUrl: string; tokens: TokenOption[] }) {
  const [selectedId, setSelectedId] = useState(tokens[0]?.id ?? "");
  const [revealed, setRevealed] = useState<CreatedToken | null>(null);

  const selectedToken = tokens.find((t) => t.id === selectedId);
  const tokenValue = revealed?.token ?? null;
  const bookmarkletCode = buildBookmarklet(appUrl);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Bookmarklet (computador)</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          Arraste o link abaixo para a barra de favoritos do navegador. Clicar nele em qualquer página abre uma
          janela pequena de captura já preenchida com o título, a URL e o texto selecionado — usa a sessão do
          navegador (você precisa estar logado), não precisa de token.
        </p>
        <a
          href={bookmarkletCode}
          draggable
          className="self-start rounded-full border border-black/[.12] px-4 py-2 text-sm font-medium text-black hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.06]"
        >
          Capturar no Hub
        </a>
        <details className="text-sm text-black/60 dark:text-white/60">
          <summary className="cursor-pointer">Ver o código (para criar o favorito manualmente)</summary>
          <pre className={`${codeBlockClassName} mt-2`}>{bookmarkletCode}</pre>
        </details>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Token para o atalho do iOS</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          O atalho do iOS chama a API diretamente (sem sessão de navegador), então precisa de um token com o
          escopo <code>capture</code> — gerencie todos em{" "}
          <a href="/configuracoes/tokens" className="underline">
            /configuracoes/tokens
          </a>
          .
        </p>

        {tokens.length > 0 && (
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Token existente
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setRevealed(null);
              }}
              className={inputClassName}
            >
              {tokens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.prefix}…)
                </option>
              ))}
            </select>
          </label>
        )}
        {selectedToken && !revealed && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            O valor completo de &ldquo;{selectedToken.name}&rdquo; só apareceu uma vez, na hora da criação — cole
            abaixo o que você copiou então (o exemplo mostra <code>SEU_TOKEN_AQUI</code> no lugar), ou crie um
            token novo.
          </p>
        )}

        <CreateInlineToken
          onCreated={(token) => {
            setRevealed(token);
            setSelectedId("");
          }}
        />

        {revealed && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-black dark:text-zinc-50">
            Token &ldquo;{revealed.name}&rdquo; criado — já preenchido no exemplo abaixo. Copie agora, ele não
            aparece de novo.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Atalho do iOS (Shortcuts)</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-black/80 dark:text-white/80">
          <li>
            Crie um atalho novo e adicione a ação <strong>Obter conteúdo da planilha de compartilhamento</strong>{" "}
            como entrada, para o atalho aparecer na folha de compartilhamento do iOS.
          </li>
          <li>
            Adicione a ação <strong>Obter conteúdo de URL</strong>, método <strong>POST</strong>, URL{" "}
            <code>{appUrl}/api/capture</code>.
          </li>
          <li>
            Em cabeçalhos da requisição, adicione <code>Authorization</code> com o valor{" "}
            <code>Bearer {tokenValue ?? "SEU_TOKEN_AQUI"}</code>.
          </li>
          <li>
            Corpo da requisição em JSON, com o campo <code>text</code> recebendo o conteúdo compartilhado.
          </li>
          <li>Em Ajustes → Compartilhar, ative o atalho para ele aparecer na folha de compartilhamento.</li>
        </ol>
        <pre className={codeBlockClassName}>{`POST ${appUrl}/api/capture
Authorization: Bearer ${tokenValue ?? "SEU_TOKEN_AQUI"}
Content-Type: application/json

{"text": "<conteúdo compartilhado>"}`}</pre>
      </section>
    </div>
  );
}

function CreateInlineToken({ onCreated }: { onCreated: (token: CreatedToken) => void }) {
  const [state, formAction, pending] = useActionState(createToken, initialCreateTokenState);
  const [name, setName] = useState("Atalho do iOS");

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok && state.data) onCreated(state.data);
    else if (!state.ok) toast.error(state.error);
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="scopes" value="capture" />
      <input type="hidden" name="validity" value="never" />
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        className={inputClassName}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-black/[.12] px-3 py-1.5 text-xs font-medium text-black hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-50 dark:hover:bg-white/[.06]"
      >
        {pending ? "Criando..." : "Criar token novo"}
      </button>
    </form>
  );
}
