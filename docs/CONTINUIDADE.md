# Continuidade — onde paramos e como seguir (atualizado em 30/09/2026)

Este arquivo existe para que **outra conta ou outra sessão do Claude Code** continue o projeto sem
perder nada. Leia nesta ordem: este arquivo → `CLAUDE.md` → `docs/00-visao-geral.md` →
`docs/PROGRESSO.md` (o que foi feito, tarefa a tarefa) → `docs/decisoes.md` (por que foi feito assim)
→ o plano da fase atual (`docs/fase-10-vida.md`).

## 1. Estado agora

- **Produto:** JKode (antes "Hub"), sistema pessoal de uma dona só. Produção em
  `https://null.prescrittomed.com.br` (Vercel). Um único projeto Supabase (`hub-dev`, ref
  `spzuvkpovmawbsiznzei`) serve de produção — não existe `hub-prod` (decisão registrada em PROGRESSO, fase 0).
- **Repositório:** `jaquekm/null`, branch padrão `main`. Fases 0–9 mescladas (a 8 foi pulada/reduzida,
  ver PROGRESSO). Fase 9 concluída (9.1–9.9).
- **PR aberta:** [#74](https://github.com/jaquekm/null/pull/74), branch `claude/blissful-darwin-ksvydv`,
  **CI verde, sem conflito, esperando só o merge da dona.** Três commits, nenhum com migration:
  1. `fix(itens)` — texto de uma Lista não some no modo lista, "Mostrar como: Lista | Texto",
     "Virar nota", página do item com "Mais ferramentas".
  2. `feat(rotina)` 10.1 — página `/rotina` (hábitos da semana, consistência).
  3. `feat(rotina)` 10.2 — aba Horários (blocos fixos na Agenda e no Hoje).
- **Fase 10 em andamento** (plano em `docs/fase-10-vida.md`, ordem aprovada pela dona:
  Rotina → Saúde → Hoje como painel → Alimentação → Finanças → Pacotes e revisão).
  Feitas: 10.1 e 10.2. **Próxima: 10.3 Modo foco.**

## 2. O que falta fazer (em ordem)

1. **Dona:** mesclar a PR #74. Depois disso, a próxima sessão começa assim:
   `git fetch origin main && git checkout -B <branch-da-sessão> origin/main` (a PR mesclada não é reaproveitada).
2. **Fase 10**, uma tarefa por vez, na ordem do plano:
   - 10.3 Modo foco (cronômetro pomodoro/livre ligado a tarefa/projeto; "onde foi meu tempo" na semana).
   - 10.4 Água · 10.5 Vitaminas e remédios (estoque, lembrete, "acaba em 5 dias") · 10.6 Peso/medidas/IMC
     (juntar com o semanal do Treinos, sem duplicar) · 10.7 Log médico.
   - 10.8 Hoje como painel (água, remédios, hábitos do dia, treino e refeições marcáveis no Hoje).
   - 10.9–10.11 Alimentação (cardápio, lista de compras e receitas, jejum).
   - 10.12–10.14 Finanças (patrimônio, desejos/caixinhas, plano de quitação).
   - 10.15 Pacotes prontos · 10.16 Revisão da semana automática.
   - Regra da fase: dado de saúde **não vai pra IA** sem o módulo ligado nas configurações (igual finanças).
3. **[HUMANO] pendente desde 29/09 — ligar o agendador:** a dona cria no Supabase → Vault os segredos
   `cron_secret` e `app_url` e avisa "pronto". Aí conferir (só os **nomes** no Vault, nunca os valores)
   que os jobs do `pg_cron` passam a disparar. Sem isso, lembretes/automações/relatórios agendados não saem.
4. **Depois, com a dona:** enxugar o menu (hoje 14 itens — ela pediu para conversar antes de mexer).
5. Pendências antigas ainda abertas em PROGRESSO: 0.4 (Supabase local nunca rodou), 0.7 (confirmar MFA
   exigido no login), 0.11/0.13. Não bloqueiam nada.

## 3. Regras de trabalho combinadas com a dona (valem sempre)

- **Segurança — nunca:** pedir ou aceitar que a dona cole `CRON_SECRET` (ou qualquer segredo) no chat;
  ler valores do Vault (só nomes); descriptografar variáveis da Vercel; **rodar migration em produção sem
  a dona pedir explicitamente** (cada migration é um pedido novo — "pode aplicar a migration").
- **Fluxo por tarefa:** implementar → `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` →
  prints (computador claro e celular escuro) → atualizar `PROGRESSO.md` (e `decisoes.md` se desviou) →
  commit em português `tipo(escopo): descrição`.
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
