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
- **Decisão:** não tentei `supabase start` — mesmo instalando o CLI, o `docker pull` das imagens do stack provavelmente falharia do mesmo jeito. Parei o `dockerd` que subi para o teste. Segui para a 0.7 (código que não depende de Supabase rodando) e, depois, voltei para fazer a parte da 0.4/0.5 que **não** precisa de Docker: instalei o Supabase CLI via `pnpm dlx supabase` (o registro do npm não passa pelo proxy da organização, funciona independente do bloqueio do Docker Hub) e rodei `supabase init` e `supabase migration new` — os dois são só operação de arquivo, sem Postgres nem Docker envolvidos.
- **Consequências:** a 0.4 continua precisando terminar na sua máquina (`supabase start`, `supabase link`) — isso não muda. Mas `supabase/config.toml` e a migration inicial (0.5) já existem no repositório, prontos para você validar com `supabase db reset` assim que rodar localmente.

### 2026-09-17 — `supabase/config.toml`: `project_id`, cadastro desligado e MFA TOTP habilitado

- **Fase/tarefa:** 0.4 (Supabase local e CLI)
- **Contexto:** `supabase init` gerou `project_id = "null"` (o nome da pasta do repositório, que por acaso é literalmente "null"). Os padrões de `enable_signup` vêm `true` (permitindo cadastro público) e os de `[auth.mfa.totp]` vêm `false` (TOTP desligado) — o oposto do que o `CLAUDE.md` (cadastro público desligado) e a tarefa 0.7 (MFA TOTP habilitado, sem página de cadastro) pedem.
- **Decisão:** troquei `project_id` para `"hub"`; `enable_signup = false` em `[auth]` e em `[auth.email]`; `enroll_enabled = true` e `verify_enabled = true` em `[auth.mfa.totp]`.
- **Consequências:** quando você rodar `supabase start` localmente, o ambiente local já nasce com essas três coisas configuradas do jeito que o plano pede — sem isso, o cadastro público local estaria aberto e o MFA local não funcionaria, mesmo com o código da 0.7 pronto. **Isso configura só o ambiente local** (`supabase/config.toml`); nos projetos `hub-dev`/`hub-prod` de verdade, o item 1 da 0.7 (desativar cadastro, habilitar MFA TOTP) continua sendo `[HUMANO]`, feito no painel do Supabase.

### 2026-09-18 — Este ambiente remoto não alcança nenhum domínio do Supabase

- **Fase/tarefa:** 0.1/0.4/0.5 — depois que o dono criou o projeto `hub-dev` e me passou as credenciais (project ref `spzuvkpovmawbsiznzei`, chaves, token de acesso pessoal, senha do banco).
- **Contexto:** tentei `supabase login --token ...` (funcionou — autentica contra a API de contas, aparentemente liberada) e depois `supabase link --project-ref spzuvkpovmawbsiznzei --password ...`, que falhou.
- **Descoberta:** a política de rede deste ambiente **bloqueia explicitamente** `api.supabase.com` (API de gestão do CLI) e também `spzuvkpovmawbsiznzei.supabase.co` (a API do próprio projeto, a mesma que o app usa em tempo de execução) — confirmado em `recentRelayFailures` do proxy: `403` / `connect_rejected` para os dois hosts. Também confirmei que não existe rota de TCP direto pra fora deste ambiente (nem pra IPs quaisquer, ex. `8.8.8.8:53`) — só o proxy HTTPS, que por sua vez nega esses dois hosts. Ou seja, mesmo que eu tentasse conectar direto no Postgres (porta 5432/6543, contornando o CLI), não teria como.
- **Decisão:** não tentei contornar (não é um limite de terceiro tipo o 429 do Docker Hub — é uma política explícita desta rede). Não apliquei a migration nem testei login/MFA daqui. Dei ao dono os comandos prontos (`supabase login`/`link`/`db push`/`gen types`) para rodar na própria máquina, que não tem essa restrição.
- **Consequências:** **nenhuma tarefa que precise falar com um Supabase de verdade (local via Docker ou hospedado como o `hub-dev`) pode ser concluída/verificada nesta sessão remota**, independente de contas ou Docker Hub. A partir de agora, tarefas assim (aplicar migration, `pnpm db:types`, testar login/MFA/RLS, Playwright contra o app rodando) precisam ser feitas pelo dono na própria máquina, ou eu só preparo o código e ele confirma. Isso não é um problema pontual da 0.4/0.5 — vale para o resto do projeto.

### 2026-09-18 — Migration aplicada via SQL Editor do painel, não pela CLI

- **Fase/tarefa:** 0.5 (Migration inicial)
- **Contexto:** com `supabase link`/`db push` bloqueados nesta sessão (decisão anterior), o dono aplicou o SQL de `supabase/migrations/20260917130714_fundacao.sql` colando direto no SQL Editor do painel do `hub-dev` (`https://supabase.com/dashboard/project/spzuvkpovmawbsiznzei/sql/new`).
- **Decisão:** aceito como equivalente a `supabase db push` para os fins da 0.5 — o resultado no banco é o mesmo. Fica documentado que, se algum dia alguém rodar `supabase db push` de um ambiente sem essa restrição, o CLI pode tentar reaplicar essa mesma migration (já que a tabela `supabase_migrations.schema_migrations` não foi atualizada por fora da CLI) — nesse caso, o `create table` vai falhar por já existir. Resolve-se então com `supabase migration repair --status applied 20260917130714` ou inserindo a linha manualmente nessa tabela.
- **Consequências:** a tabela `user_settings` e a função/trigger `set_updated_at()` existem de verdade no `hub-dev`. `database.types.ts` continua sendo o placeholder da decisão da 0.6 (não deu pra rodar `supabase gen types` por causa do mesmo bloqueio de rede) — ainda vale a pena gerar os tipos reais quando alguém rodar a CLI num ambiente sem essa restrição.

### 2026-09-18 — Deploy usa só o projeto `hub-dev` (sem `hub-prod`) e variáveis de ambiente da Vercel precisaram ser recriadas

- **Fase/tarefa:** 0.1, 0.10 (Deploy no subdomínio)
- **Contexto:** ao importar o repositório na Vercel, ela detectou o `.env.example` (que lista as variáveis de **todas** as fases) e pré-criou uma entrada vazia para cada uma — inclusive as das fases 2/3, ainda não usadas. Ao tentar preencher `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, a Vercel travou: essas variáveis tinham sido criadas com o tipo "Secret" (write-only), e o tipo "Secret" não pode ser convertido para "Config" depois de salvo — só é possível escolher o tipo na criação. "Secret" com prefixo `NEXT_PUBLIC_` também não é permitido salvar (a Vercel bloqueia, considerando contraditório: uma variável marcada como sigilosa que o Next.js vai expor no navegador).
- **Decisão:** apagamos as duas variáveis `NEXT_PUBLIC_*` e recriamos do zero como tipo **Config** (que aceita ser pública). `SUPABASE_SERVICE_ROLE_KEY` continua como **Secret**, sem esse problema (não tem prefixo público). Além disso, decidimos usar o projeto **`hub-dev` para tudo** (Production, Preview e Development na Vercel) — não criamos um `hub-prod` separado, já que é um projeto pessoal pequeno e a organização Free do Supabase permite só um número limitado de projetos.
- **Consequências:** hoje não existe isolamento entre "desenvolvimento" e "produção" — é o mesmo banco. Aceitável para agora; quando fizer sentido, criar `hub-prod` e apontar só o ambiente "Production" da Vercel pra ele, mantendo Preview/Development no `hub-dev`.

## Decisões em aberto previstas no plano

- [ ] Provedor de transcrição (fase 2.4) — preço por hora na data da escolha
- [ ] Estratégia de eventos recorrentes do Google Calendar (fase 3.5)
- [ ] Biblioteca da agenda: FullCalendar ou componente próprio (fase 3.6)
- [ ] Integração do WhatsApp no N8N: Cloud API ou integração existente (fase 3.9)
- [ ] Provedor, modelo e dimensão de embeddings (fase 6.5)
- [ ] Destino dos backups externos (fase 7.1)
- [ ] Modelo do Claude usado em `ANTHROPIC_MODEL`
