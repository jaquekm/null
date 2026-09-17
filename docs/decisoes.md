# Registro de decisões

Registre aqui toda escolha que desvia do plano ou que o plano deixou em aberto (provedores, bibliotecas, limites).

## Modelo

### AAAA-MM-DD — Título da decisão
- **Fase/tarefa:** 
- **Contexto:** o que precisava ser decidido
- **Opções consideradas:** 
- **Decisão:** 
- **Consequências:** custos, limites, o que muda no código

## Decisões tomadas

### 2026-09-17 — Ordem das tarefas 0.5/0.6 e placeholder de `database.types.ts`

- **Fase/tarefa:** 0.6 (Clientes Supabase)
- **Contexto:** o dono pediu para adiantar a 0.6 antes da 0.4/0.5 (Supabase local ainda não configurado neste ambiente — sem Docker/Supabase CLI). O plano previa que `database.types.ts` só existiria depois de `supabase db reset` + `pnpm db:types`.
- **Opções consideradas:** (1) esperar a 0.4/0.5 para escrever `server.ts`/`client.ts`/`admin.ts`; (2) criar um `database.types.ts` placeholder com `Tables`/`Views`/etc. vazios, no mesmo formato do gerado por `supabase gen types typescript`, e escrever os clientes já tipados com ele.
- **Decisão:** opção 2. `src/lib/supabase/database.types.ts` tem uma nota no topo avisando que será sobrescrito pela 0.5.
- **Consequências:** quando a 0.5 rodar `pnpm db:types` de verdade, este arquivo placeholder será substituído. Nenhuma tabela real é referenciada nos clientes, então não há retrabalho. **Não verificado neste ambiente:** o critério de aceite da 0.6 ("acessar `/inbox` sem login redireciona; rotas públicas respondem sem login") depende de um Supabase real (local ou `hub-dev`) respondendo às chamadas de `auth.getUser()` no proxy — sem isso, `pnpm dev` falha ao tentar validar as variáveis de ambiente (comportamento esperado da 0.3) ou, com variáveis fictícias, falharia na chamada de rede. Precisa ser confirmado manualmente assim que a 0.4 (ou a 0.1) estiver pronta.

### 2026-09-17 — `env.ts` com validação preguiçosa (lazy) + proxy sai cedo em rotas públicas

- **Fase/tarefa:** 0.9/0.12, corrigindo um bug introduzido na 0.6.
- **Contexto:** ao testar os cabeçalhos de segurança (0.9) e o health check (0.12) com `pnpm build && next start` sem nenhuma variável do Supabase configurada, `GET /api/health` — uma rota pública, que não deveria depender do Supabase — respondia 500. Duas causas, uma em cima da outra: (1) `src/proxy.ts` criava o cliente Supabase e chamava `auth.getUser()` **antes** de checar `isPublicPath`, gastando uma dependência desnecessária em toda rota pública; (2) mesmo corrigindo isso, `publicEnv`/`serverEnv` em `src/lib/env.ts` eram validados **no import do módulo** (efeito colateral de topo de arquivo), então só o `import { publicEnv } from "@/lib/env"` no topo do `proxy.ts` já derrubava a requisição antes de qualquer lógica rodar.
- **Opções consideradas:** (1) manter a validação eager e mover o `import` do Supabase para dentro do `if` (não resolve — o import de `env.ts` já falha antes); (2) tornar `publicEnv`/`serverEnv` objetos com validação preguiçosa via `Proxy`, rodando o `zod.safeParse` só na primeira leitura de uma propriedade.
- **Decisão:** opção 2, combinada com o proxy checando `isPublicPath` e retornando `NextResponse.next()` antes de instanciar qualquer cliente Supabase.
- **Consequências:** rotas públicas (`/api/health`, `/api/webhooks/*`, `/api/jobs/tick`, `/api/capture`, `/api/mcp`, `/p/*`, `/login`) não dependem mais do Supabase estar configurado ou acessível — elas validam seu próprio segredo/token, como já dizia a seção de Segurança do `CLAUDE.md`. `src/lib/env.test.ts` foi ajustado: os testes de variável ausente agora leem uma propriedade (`serverEnv.OWNER_EMAIL`, `publicEnv.NEXT_PUBLIC_SUPABASE_URL`) em vez de esperar que o `import()` rejeite. Verificado com `pnpm build && next start` + `curl -I` em `/api/health` (200) e `/p/algum-token` (responde, com `Referrer-Policy: no-referrer`), sem nenhuma variável do Supabase definida.

### 2026-09-17 — `pnpm typecheck` roda `next typegen` antes do `tsc --noEmit`

- **Fase/tarefa:** 0.11 (CI)
- **Contexto:** no Next.js 16, `layout.tsx`/`page.tsx` usam tipos ambientes gerados pelo próprio Next (`LayoutProps<'/'>`, etc.) em `.next/types/`, criados só quando `next dev`, `next build` ou `next typegen` rodam pelo menos uma vez. Testando o workflow de CI localmente (checkout limpo, sem `.next/`), `pnpm typecheck` falhava com `Cannot find name 'LayoutProps'` — o mesmo aconteceria em todo PR/push no GitHub Actions, e também para qualquer pessoa rodando `pnpm typecheck` num clone novo antes de um `pnpm dev`/`build`.
- **Opções consideradas:** (1) rodar `pnpm build` antes do `pnpm typecheck` no workflow de CI (redundante — o build já roda seu próprio typecheck interno, então o job faria a checagem de tipos duas vezes); (2) usar `next typegen` (comando novo do Next 16, "gera os tipos sem rodar o build completo") como primeiro passo do próprio script `typecheck` no `package.json`.
- **Decisão:** opção 2 — `"typecheck": "next typegen && tsc --noEmit"`. Assim `pnpm typecheck` funciona sozinho em qualquer ambiente (CI ou clone novo), sem exigir um build antes nem duplicar a checagem de tipos do build.
- **Consequências:** nenhuma mudança de comportamento fora do necessário; só corrige um `pnpm typecheck` que já estava quebrado em checkout limpo (não era um problema introduzido agora, só não tinha aparecido porque sempre rodei os comandos depois de um `pnpm build`/`dev`).

### 2026-09-17 — Dark mode por classe (`next-themes`) em vez de `prefers-color-scheme`

- **Fase/tarefa:** 0.8 (Layout da aplicação)
- **Contexto:** o `globals.css` gerado pelo `create-next-app` decide claro/escuro só por `@media (prefers-color-scheme: dark)`, ou seja, segue o SO e não pode ser trocado manualmente. A 0.8 pede tema "claro/escuro/sistema" com `next-themes`, que funciona pondo a classe `dark` no `<html>`.
- **Decisão:** troquei o `@media` por `@custom-variant dark (&:where(.dark, .dark *));` (sintaxe do Tailwind v4 para variante por classe) e movi as cores escuras de dentro do `@media` para um seletor `.dark`. `src/app/layout.tsx` ganhou `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) e `suppressHydrationWarning` no `<html>` (necessário porque o `next-themes` ajusta a classe antes da hidratação, via script).
- **Consequências:** todo `dark:` que já existia em `page.tsx`, `error.tsx`, `not-found.tsx` etc. continua funcionando sem alteração — só passou a responder à escolha do usuário (guardada pelo `next-themes` em `localStorage`) em vez de só ao SO.

### 2026-09-17 — `useSyncExternalStore` em vez de `useEffect`+`setState` para o guard de hidratação do `ThemeToggle`

- **Fase/tarefa:** 0.8 (Layout da aplicação)
- **Contexto:** o padrão recomendado pela própria documentação do `next-themes` para evitar o tema piscar/divergir na hidratação é um `mounted` guardado em `useState`, setado em `useEffect(() => setMounted(true), [])`. A versão do `eslint-config-next` deste projeto tem a regra `react-hooks/set-state-in-effect`, que trata isso como erro ("calling setState synchronously within an effect can trigger cascading renders").
- **Opções consideradas:** (1) desabilitar a regra pontualmente com um comentário eslint-disable; (2) reescrever o guard com `useSyncExternalStore`, que não chama `setState` em efeito nenhum.
- **Decisão:** opção 2 — `src/lib/use-mounted.ts` exporta `useMounted()` implementado com `useSyncExternalStore(subscribeNoop, () => true, () => false)`. `subscribe` nunca notifica mudança (não há "external store" de verdade mudando), então o componente só re-renderiza uma vez, na hidratação, quando o snapshot do cliente (`true`) diverge do snapshot do servidor (`false`) — sem passar por `setState` num efeito.
- **Consequências:** zero avisos/erros do eslint; o hook é pequeno e pode ser reaproveitado por qualquer componente futuro que precise do mesmo guard (ex.: algo que leia `localStorage` diretamente).

### 2026-09-17 — Verificação visual da 0.8 não foi possível neste ambiente

- **Fase/tarefa:** 0.8 (Layout da aplicação)
- **Contexto:** o critério de aceite da 0.8 pede confirmar visualmente que o layout é responsivo (375 px e desktop) e que o tema alterna. Toda rota do grupo `(app)` passa por `requireOwner()`, que precisa de um Supabase real — que não existe neste ambiente (mesma limitação já registrada na decisão da 0.6). Tentei contornar isso só para tirar prints, comentando temporariamente a chamada a `requireOwner()` e cogitando desativar o `proxy.ts` durante o teste, restaurando os dois logo em seguida.
- **Decisão:** não insisti nisso — o classificador de segurança do Claude Code bloqueou a ação por enfraquecer o gate de autenticação, mesmo sendo uma alteração local e temporária só para inspeção visual. Reverti a edição de teste imediatamente (`proxy.ts` nunca chegou a ser tocado, o bloqueio ocorreu antes) e segui só com a verificação por `lint`/`typecheck`/`test`/`build` e revisão manual das classes Tailwind responsivas (`md:` para trocar sidebar/bottom-nav, `hidden`/`flex` etc.).
- **Consequências:** a tarefa 0.8 fica com o código pronto mas **sem confirmação visual** — quando o dono tiver login funcionando (0.7) e um Supabase configurado (0.1/0.4), precisa abrir `/inbox` no navegador, testar em 375 px e no desktop, e clicar no botão de tema algumas vezes para confirmar que os três estados (claro/escuro/sistema) funcionam.

### 2026-09-17 — Docker existe neste ambiente, mas `supabase start` não é viável aqui

- **Fase/tarefa:** 0.4 (Supabase local e CLI) — investigação antes de pular direto para a 0.7.
- **Contexto:** antes de assumir que a 0.4 estava bloqueada só por falta de conta (0.1), verifiquei se o ambiente remoto tinha Docker. Tinha: `docker`/`dockerd` instalados, e o daemon sobe normalmente (`dockerd &`, `docker ps` funciona depois). Testei `docker pull hello-world` para confirmar se dava pra rodar o stack local do Supabase (que baixa ~10 imagens: Postgres, GoTrue, PostgREST, Realtime, Storage, Kong, Studio etc.).
- **Descoberta:** `docker pull` falha com `429 Too Many Requests` do próprio Docker Hub (`registry-1.docker.io`) — confirmei no status do proxy do agente (`recentRelayFailures` vazio) que a requisição chegou até o Docker Hub de verdade e foi ele quem recusou, não uma política de rede da organização. É o limite de pulls anônimos do Docker Hub, provavelmente já consumido pelo IP de saída compartilhado deste ambiente.
- **Decisão:** não instalei o Supabase CLI nem tentei `supabase start` — mesmo que o CLI funcionasse, o `docker pull` das imagens do stack provavelmente falharia do mesmo jeito. Parei o `dockerd` que subi para o teste e seguido para a 0.7 (código que não depende de Supabase rodando).
- **Consequências:** a 0.4 continua precisando ser feita na sua máquina (ou em outro ambiente com acesso ao Docker Hub), como o plano original já previa — isso não muda nada, só confirma que não tem atalho aqui.

## Decisões em aberto previstas no plano

- [ ] Provedor de transcrição (fase 2.4) — preço por hora na data da escolha
- [ ] Estratégia de eventos recorrentes do Google Calendar (fase 3.5)
- [ ] Biblioteca da agenda: FullCalendar ou componente próprio (fase 3.6)
- [ ] Integração do WhatsApp no N8N: Cloud API ou integração existente (fase 3.9)
- [ ] Provedor, modelo e dimensão de embeddings (fase 6.5)
- [ ] Destino dos backups externos (fase 7.1)
- [ ] Modelo do Claude usado em `ANTHROPIC_MODEL`
