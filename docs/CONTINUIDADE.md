# Continuidade — onde paramos e como seguir (atualizado em 03/10/2026)

Este arquivo existe para que **outra conta ou outra sessão do Claude Code** continue o projeto sem
perder nada. Leia nesta ordem: este arquivo → `CLAUDE.md` → `docs/00-visao-geral.md` →
`docs/PROGRESSO.md` (índice; o que foi feito está em `docs/progresso/fase-NN*.md`, dividido por fase
desde 01/10 — arquivo único ficou grande demais pra publicar) → `docs/decisoes.md` (índice; por que foi
feito assim está em `docs/decisoes/*.md`, dividido em partes pelo mesmo motivo) → o plano da fase atual
(`docs/fase-10-vida.md`).

## 1. Estado agora

- **Produto:** JKode (antes "Hub"), sistema pessoal de uma dona só. Produção em
  `https://null.prescrittomed.com.br` (Vercel). Um único projeto Supabase (`hub-dev`, ref
  `spzuvkpovmawbsiznzei`) serve de produção — não existe `hub-prod` (decisão registrada em PROGRESSO, fase 0).
- **Repositório:** `jaquekm/null`, branch padrão `main`. Fases 0–10 mescladas (a 8 foi pulada/reduzida).
- **Banco de produção em dia com o repositório** (03/10): as 8 migrations da fase 10 (`20261009`–`20261016`)
  foram aplicadas a pedido da dona. Antes de declarar uma tarefa com migration pronta, confira com
  `list_migrations` (MCP do Supabase) que ela está aplicada — ou deixe escrito aqui que está pendente.
- **Migration do link de edição aplicada em produção (07/10, a pedido da dona):** `20261017000000_link_editar_lista.sql`
  (permissão `edit` em `share_links` e tipos de evento `add/rate/edit/delete` em `share_link_events`), registrada no
  banco como `20261007150710 link_editar_lista`. Conferido pelas definições das restrições e por `list_migrations`.
  O código do link de edição só chega ao ar quando o PR #92 for mesclado.
- **Ajustes de 03/10** (branch `claude/blissful-darwin-ksvydv`, PR em rascunho): editar treino, cardápio com
  ingredientes no próprio prato, "pagar … R$ … dia …" vira conta a pagar, "Por que meus avisos não chegam?",
  explicação do Zettelkasten, botão "Como funciona" nos módulos. Detalhes em `docs/progresso/fase-10.md`.

## 2. O que falta fazer (em ordem)

1. **[HUMANO] Ligar o agendador — pendente desde 29/09 e é o motivo de nenhum lembrete chegar.** Conferido
   em 03/10: o Vault está vazio e o `pg_cron` falha a cada minuto (`url` nulo). A dona cria no Supabase →
   Integrations → Vault os segredos `app_url` (https://null.prescrittomed.com.br) e `cron_secret` (mesmo valor
   da `CRON_SECRET` da Vercel, copiado de lá direto — nunca pelo chat). Depois, conferir só os **nomes** no
   Vault e que `cron.job_run_details` passa a mostrar `succeeded`. A tela Configurações → Notificações mostra
   o estado sozinha.
2. **[HUMANO] Ativar notificação no aparelho** (0 inscrições em 03/10): Configurações → Notificações →
   "Ativar neste aparelho"; no iPhone, instalar o app na tela inicial antes.
3. **WhatsApp:** os lembretes da dona estão no canal WhatsApp; só saem com o número cadastrado **e** o fluxo
   do N8N ligado (`docs/n8n-whatsapp.md`). Até lá, sugerir canal "Notificação".
4. Validar com a dona, em uso real, as telas que ainda não foram vistas com login (10.3 foco, 10.5 remédios).
5. **Depois, com a dona:** enxugar o menu (hoje 13 itens).
6. Pendências antigas em PROGRESSO: 0.4 (Supabase local), 0.7 (MFA exigido no login), 0.11/0.13. Não bloqueiam.

## 3. Regras de trabalho combinadas com a dona (valem sempre)

- **Segurança — nunca:** pedir ou aceitar que a dona cole `CRON_SECRET` (ou qualquer segredo) no chat;
  ler valores do Vault (só nomes); descriptografar variáveis da Vercel; **rodar migration em produção sem
  a dona pedir explicitamente** (cada migration é um pedido novo — "pode aplicar a migration").
- **Fluxo por tarefa:** implementar → `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` →
  prints (computador claro e celular escuro) → atualizar `docs/progresso/fase-NN.md` da fase atual (e o
  último `docs/decisoes/NN-*.md` se desviou) — nunca editar `PROGRESSO.md`/`decisoes.md` direto, são só
  índice → commit em português `tipo(escopo): descrição`.
- **PRs:** sempre em rascunho (draft). Enquanto uma PR está aberta, a tarefa seguinte vai para a mesma
  branch (foi assim com a #74, porque o gancho do ambiente exige enviar todo commit). Depois do merge,
  a branch recomeça de `origin/main` e abre PR nova. Acompanhar a PR até mesclar (CI, conflitos, comentários).
- **Evitar migration quando dá:** preferências pequenas da dona vão em `user_settings.preferences`
  (JSON, com RLS de dono) — já estão lá: `ownerWhatsapp` (9.8) e `routineBlocks` (10.2). Hábitos são
  itens do tipo Hábito (`properties.log`/`properties.frequency`), sem tabela própria.
- **Textos para a dona:** português simples, sem jargão; explicar o que muda na tela dela.

## 4. Armadilhas técnicas já descobertas (economizam horas)

- **Next.js 16:** `middleware.ts` virou `src/proxy.ts`; páginas usam `PageProps<"/rota">`
  (`searchParams` é Promise); `pnpm typecheck` roda `next typegen` antes do `tsc`.
- **ESLint (react-hooks do React Compiler):** não pode `setState` síncrono dentro de `useEffect`
  (use `useSyncExternalStore` ou estado derivado), nem escrever em `ref` durante o render (atualize em
  `useEffect`), nem chamar `new Date()`/`Date.now()` no corpo do componente (use `useState(() => …)`
  ou receba "hoje" do servidor por prop).
- **Zod 4:** `.refine()` num `z.object` impede `.extend()` depois — declare os campos num objeto
  separado e aplique o `refine` por cima (ver `routine/lib/routine-blocks.ts`).
- **Não rodar prettier no arquivo inteiro** — o repositório usa linhas longas; formatar só o que mudou.
- **`database.types.ts` é editado à mão** quando entra migration (o ambiente remoto não alcança o
  Supabase pela CLI). Migrations em produção vão pelo MCP do Supabase (`apply_migration`), com pedido da dona.
- **Rede do ambiente remoto:** `api.supabase.com` e o host do projeto ficam bloqueados para a CLI;
  Docker Hub dá 429 (sem `supabase start`). Use o MCP do Supabase/Vercel para consultar produção.
- **Chromium** tem `SpeechRecognition` nativo sem prefixo — para testar ditado, simule os dois
  (`SpeechRecognition` e `webkitSpeechRecognition`).
- **`items.source`** não tem check constraint (valores em uso: quick, web, share, api, voice, import,
  automation, rotina).

## 5. Como tirar print de uma tela sem login (receita usada nas fases 9–10)

As páginas exigem login + MFA, então os prints são de uma **prévia isolada** do componente:

1. `pnpm build` e junte o CSS: `cat .next/static/chunks/*.css > $SP/app.css` (`$SP` = pasta de rascunho).
2. Crie `src/zz-preview/entry-x.tsx` que monta `Sidebar` + `TopBar` + o componente com dados de exemplo
   (`createRoot(document.getElementById("root")!).render(...)`; defina `window.__path` para o menu ativo).
3. Crie `src/zz-preview/stub.tsx` substituindo tudo que é servidor, por exemplo:
   ```tsx
   import type { ReactNode } from "react";
   const ok = async () => ({ ok: true, data: {} });
   export const toggleHabitLog = ok, saveRoutineBlock = ok; // + cada ação que o bundle pedir
   export const toast = { success() {}, error() {} };
   export function useRouter() { return { refresh() {}, push() {} }; }
   export function usePathname() { return (window as unknown as { __path: string }).__path; }
   export default function Link({ href, children, ...rest }: { href: string; children: ReactNode; [k: string]: unknown }) { return <a href={href} {...rest}>{children}</a>; }
   ```
4. Empacote com esbuild (já vem nas dependências), redirecionando para o stub todo import que termina em
   `actions` e mais `sonner`, `next/navigation`, `next/link`, `server-only`:
   ```js
   import { build } from "esbuild"; // ou o caminho em node_modules/.pnpm/esbuild@*/…
   const stub = path.resolve("src/zz-preview/stub.tsx");
   const plugin = { name: "stubs", setup(b) { b.onResolve({ filter: /(^|\/)actions$|^(sonner|next\/navigation|next\/link|server-only)$/ }, () => ({ path: stub })); } };
   await build({ entryPoints: ["src/zz-preview/entry-x.tsx"], bundle: true, outfile: SP + "/x.js", jsx: "automatic", alias: { "@": "./src" }, define: { "process.env.NODE_ENV": '"production"' }, plugins: [plugin] });
   ```
   Se reclamar "No matching export … for import X", acrescente `X` no stub.
5. HTML: `<link rel="stylesheet" href="app.css">`, um script que põe a classe `dark` no `<html>` quando
   a URL termina em `#dark`, `<div id="root">` e `<script src="x.js">`.
6. Playwright (rode o script **a partir da raiz do repo**, senão não acha `@playwright/test`), com
   `chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })`, viewports 1280×900 (claro) e
   390×844 (`#dark`), `deviceScaleFactor: 2`, `fullPage: true`.
7. **Apague `src/zz-preview/` e o script** antes de commitar.

## 6. Coisas desta conta que a outra não vê

- Um lembrete automático ("Check-in PR #74 itens + rotina") foi agendado nesta conta para conferir a PR.
  Ele não passa para a conta nova — a nova sessão deve simplesmente olhar a PR #74 ao começar.
- Conectores (GitHub, Supabase, Vercel) precisam ser ligados de novo na conta nova, com acesso ao
  repositório `jaquekm/null`, ao projeto Supabase `spzuvkpovmawbsiznzei` e ao projeto Vercel `null`.
