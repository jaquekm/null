# Progresso do projeto

Marque `[x]` ao concluir. Anote decisões e desvios na coluna de observações ou em `docs/decisoes.md`.


## Fase 0 — Fundação

Documento: `docs/fase-00-fundacao.md`

- [x] **0.1** [HUMANO] Contas e serviços (só `hub-dev` — sem `hub-prod` por enquanto, ver observação)
- [x] **0.2** Criar o projeto Next.js
- [x] **0.3** Variáveis de ambiente
- [ ] **0.4** Supabase local e CLI (`init` feito; `start` local nunca rodou — não bloqueia mais nada, ver observação)
- [x] **0.5** Migration inicial (aplicada no `hub-dev` via SQL Editor do painel, não via `supabase db push`)
- [x] **0.6** Clientes Supabase (confirmado em produção — login e layout funcionando contra o `hub-dev`)
- [ ] **0.7** Autenticação com MFA (login com senha confirmado; falta cadastrar um fator TOTP e confirmar que o código é exigido)
- [x] **0.8** Layout da aplicação (confirmado visualmente em produção — responsivo, sidebar, navegação)
- [x] **0.9** Cabeçalhos de segurança
- [x] **0.10** Deploy no subdomínio (`null.prescrittomed.com.br`, produção rodando sem erros)
- [ ] **0.11** CI (workflow pronto — falta confirmar "verde" rodando de verdade no GitHub, ver observação)
- [x] **0.12** Health check e página de erro
- [ ] **0.13** Testes da fase

Observações:

- **0.2**: projeto criado com `create-next-app` (Next.js 16.3.5, App Router, `src/`, Turbopack). Estrutura de pastas do `CLAUDE.md` criada com `.gitkeep` nas pastas ainda vazias. `tsconfig.json` com `strict` + `noUncheckedIndexedAccess`. Scripts `typecheck`, `test`, `test:watch`, `test:e2e`, `db:types` adicionados ao `package.json`. `next lint` não existe mais nesta versão do Next — o script `lint` chama `eslint` diretamente (gerado assim pelo próprio `create-next-app`).
- **0.2**: `shadcn init` (tarefa 0.2, componentes shadcn/ui) **bloqueado**: a política de rede deste ambiente nega conexão com `ui.shadcn.com` (403 no proxy). Não foi feito — depende de liberar esse domínio ou rodar a inicialização em outro ambiente com rede liberada.
- **0.2**: Next.js 16 gera automaticamente `AGENTS.md` (regras específicas da versão, escritas por `next dev`) e referencia com `@AGENTS.md` no topo do `CLAUDE.md` — mantido, pois o próprio arquivo diz que será recriado a cada `next dev`.
- **0.2**: `.prettierrc.json` (com `prettier-plugin-tailwindcss`) e scripts `format`/`format:check` adicionados. `.prettierignore` exclui `docs/`, `CLAUDE.md` e `COMO-USAR-COM-CLAUDE-CODE.md` — são conteúdo de planejamento do dono, não código, e não devem ser reformatados por ferramenta.
- **0.3**: `src/lib/env.ts` criado com dois schemas Zod (`publicEnv`, com as variáveis `NEXT_PUBLIC_*`, e `serverEnv`, com o restante). `serverEnv` lança erro se acessado no cliente (proxy que verifica `typeof window`). Variáveis das fases 2, 3, 6 e 7 são opcionais, como pedido. Testado em `src/lib/env.test.ts` (vitest, ambiente `node`).
- **0.3**: adicionado `vitest.config.mts` (ambiente `node` por padrão — testes de componente que precisarem de DOM devem declarar `// @vitest-environment jsdom` no topo do arquivo).
- **0.6 (código feito antes da 0.4/0.5, a pedido do dono)**: `src/lib/result.ts` (com testes), `src/lib/supabase/{server,client,admin}.ts` (tipados com um `database.types.ts` placeholder — ver `docs/decisoes.md`), `src/lib/auth.ts` (`requireOwner()`) e `src/proxy.ts` (renomeado de `middleware.ts` pelo Next 16). A lógica de rotas públicas ficou em `src/lib/public-paths.ts` (função pura, testada em `public-paths.test.ts`) para não acoplar o teste às variáveis de ambiente que o `proxy.ts` carrega. `pnpm lint/typecheck/test/build` passam. **Não marcado como concluído**: o critério de aceite ("acessar `/inbox` sem login redireciona; rotas públicas respondem sem login") só pode ser verificado com um Supabase real respondendo, então falta confirmar isso assim que a 0.1/0.4 estiverem prontas.
- **0.6 (correção feita durante a 0.9/0.12)**: `src/proxy.ts` chamava o Supabase (e portanto exigia `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` reais) **para toda requisição, inclusive rotas públicas** — `/api/health` quebrava com 500 mesmo sem nenhuma tentativa de login. Corrigido: o proxy agora sai cedo (`isPublicPath`) antes de tocar no Supabase. Além disso, `src/lib/env.ts` validava `publicEnv`/`serverEnv` **no import do módulo**, então só importar `env.ts` (o que `proxy.ts` faz sempre) já derrubava a requisição antes do `isPublicPath` rodar. Troquei para validação preguiçosa (`Proxy`, só valida na primeira leitura de uma propriedade). Confirmado com `pnpm build` + `next start` + `curl -I`: `/api/health` responde 200 e `/p/*` responde com `Referrer-Policy: no-referrer`, ambos sem nenhuma variável do Supabase configurada; `/` (protegida) responde 500 porque *essa* rota de fato precisa do Supabase — comportamento esperado, pendente da 0.1/0.4.
- **0.9**: cabeçalhos configurados em `next.config.ts` (`headers()`): `X-Robots-Tag`, `Referrer-Policy` (com `no-referrer` só em `/p/*`), `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy` (`microphone=(self)`, câmera e geolocalização negadas) e uma CSP básica (comentário no arquivo explica como estender ao integrar domínios externos). `public/robots.txt` com `Disallow: /`. Verificado com `curl -I` contra `next start` (ver decisão acima).
- **0.12**: `GET /api/health` em `src/app/api/health/route.ts` (`{ status, time, version }`, `version` via `VERCEL_GIT_COMMIT_SHA` com fallback `"dev"`, sem detalhes internos), com teste. `src/app/error.tsx` e `src/app/not-found.tsx` em português, usando as mesmas cores do `page.tsx` padrão (shadcn/ui ainda não instalado — ver pendência da 0.2).
- **0.11**: `.github/workflows/ci.yml` roda em push na `main` e em pull requests: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (o passo opcional de Supabase local + `db reset` fica para quando a 0.5 existir). Simulei localmente exatamente essa sequência num checkout limpo (`rm -rf .next` antes) e encontrei um bug real: `pnpm typecheck` falhava com `Cannot find name 'LayoutProps'` porque os tipos de rota do Next 16 só existem depois de `next dev`/`build` rodarem uma vez — o que nunca tinha acontecido num checkout novo. Corrigido trocando o script para `"typecheck": "next typegen && tsc --noEmit"` (ver `docs/decisoes.md`). **Não marcado como concluído**: o critério de aceite é "CI verde na main", e este repositório ainda não tem uma branch `main` nem PR aberto — o workflow não roda até isso existir. Vou continuar trabalhando na branch `claude/new-session-oe2fyt` (a designada para esta sessão); confirme o CI verde assim que criar/mesclar para `main`.
- **0.8**: `src/app/(app)/layout.tsx` chama `requireOwner()` e monta o shell: `Sidebar` (desktop, recolhível, com os 8 itens — Inbox, Buscar, Agenda, Finanças, Contatos, Relatórios, Estudos, Configurações — mais uma seção "Espaços — em breve"), `BottomNav` (mobile: Inbox, Buscar, "+" de captura, Agenda, Menu — o Menu abre `MobileMenu`, tela cheia com todos os itens + tema + sair) e `TopBar` (busca placeholder desabilitada, botão de captura, `ThemeToggle`, `UserMenu` com e-mail e "Sair"). Cada rota do menu (`(app)/*/page.tsx`) por enquanto só renderiza `<PlaceholderPage title="..." />` ("Em breve") — nenhum módulo tem funcionalidade real ainda, como pedido. `src/app/page.tsx` agora redireciona `/` para `/inbox` (antes era a página de demonstração do `create-next-app`); os SVGs de exemplo em `public/` que só ela usava foram removidos.
- **0.8**: tema claro/escuro/sistema com `next-themes` (`ThemeProvider` no `src/app/layout.tsx`, que também ganhou `lang="pt-BR"`, `suppressHydrationWarning` e `<Toaster />` do `sonner`, novo na dependência). `globals.css` trocou de dark mode por `prefers-color-scheme` para `@custom-variant dark (&:where(.dark, .dark *))`, controlado pela classe que o `next-themes` põe no `<html>` — sem essa troca, alternar o tema manualmente não funcionaria (a página sempre seguiria o SO).
- **0.8**: o padrão usual de "aguardar montar no cliente" (`useEffect` + `setState`) para evitar divergência de hidratação no `ThemeToggle` é rejeitado pela regra `react-hooks/set-state-in-effect` do `eslint-config-next` atual. Troquei por um hook `useMounted()` (`src/lib/use-mounted.ts`) baseado em `useSyncExternalStore`, que não dispara a regra.
- **0.8**: `pnpm lint/typecheck/test/build` passam (29 testes, incluindo `nav-items.test.ts` para os itens do menu). **Não marcado como concluído**: o critério de aceite ("layout responsivo em 375 px e em desktop, tema alternando") pede verificação visual num navegador. Tentei fazer isso desativando temporariamente o `requireOwner()`/`proxy.ts` só para tirar prints — o classificador de segurança do Claude Code bloqueou a ação (enfraquecer o gate de auth, mesmo que temporário e local), e não tentei contornar. Como toda rota do `(app)` exige `requireOwner()`, e isso exige um Supabase de verdade, não dá para abrir essas páginas num navegador até a 0.1/0.4 (mesma limitação já registrada na 0.6). Por favor confirme visualmente (375 px, desktop, alternando claro/escuro/sistema) assim que tiver login funcionando.
- **0.8**: pendências conhecidas e esperadas nesta altura do plano: o botão de captura aponta para `/capturar`, que ainda não existe (tarefa 1.10); o "Sair" do menu redireciona para `/login`, que também ainda não existe (tarefa 0.7). Isso é o mesmo tipo de dependência incompleta já visto no proxy (0.6) — nada quebrado, só código esperando as próximas tarefas.
- **0.4 (tentativa)**: este ambiente remoto **tem Docker** (`docker` e `dockerd` instalados, o daemon sobe normalmente com `dockerd &`), mas o `docker pull` de qualquer imagem falha com `429 Too Many Requests` do Docker Hub (limite de pulls anônimos — não é bloqueio do proxy da organização, o `docker pull hello-world` chega até o registry e leva o 429 de lá mesmo). Ou seja, `supabase start` não conseguiria baixar as ~10 imagens do stack local (Postgres, GoTrue, PostgREST, Realtime, Storage, Kong, Studio...). Parei o `dockerd` que tinha subido para teste.
- **0.4**: instalei o Supabase CLI via `pnpm dlx supabase` (vem do registro do npm, que este ambiente acessa sem passar pelo proxy da organização — funciona independente do bloqueio do Docker Hub) e rodei `supabase init`, que só mexe em arquivos (sem precisar de Docker): criou `supabase/config.toml` e `supabase/.gitignore`. Ajustei `project_id` de `"null"` (nome do diretório do repo) para `"hub"`, e no `[auth]`/`[auth.email]` deixei `enable_signup = false` (cadastro público desligado, como manda o `CLAUDE.md` e o item 1 da 0.7) e em `[auth.mfa.totp]` liguei `enroll_enabled`/`verify_enabled` (vinham `false` por padrão — sem isso a 0.7 nem funcionaria localmente). **Continua sem marcar `[x]`**: falta `supabase start` (bloqueado pelo 429 do Docker Hub, acima) e `supabase link` com o projeto `hub-dev` real (`[HUMANO]`, tarefa 0.1).
- **0.5**: `supabase migration new fundacao` gerou `supabase/migrations/20260917130714_fundacao.sql` (nome/timestamp no formato certo, sem precisar de Docker). Preenchi com o SQL exatamente como está em `docs/fase-00-fundacao.md` — extensões (`pgcrypto`, `pg_trgm`, `unaccent`), a função/trigger `set_updated_at()` e a tabela `user_settings` com RLS + política de dono. **Não marcado como concluído**: não tem como rodar `supabase db reset` (precisa do Postgres local, que precisa do Docker, que está bloqueado — ver 0.4) nem `pnpm db:types` para substituir o placeholder de `database.types.ts` (ver decisão da 0.6) por tipos de verdade. Assim que você rodar `supabase start` na sua máquina, rode `supabase db reset` e `pnpm db:types` para validar esta migration e gerar os tipos reais.
- **0.4/0.5 (descoberta importante)**: depois de criar o `hub-dev` e me passar as credenciais, tentei `supabase login` (funcionou) e `supabase link --project-ref spzuvkpovmawbsiznzei` (falhou). Este ambiente remoto **bloqueia por política `api.supabase.com` e também `spzuvkpovmawbsiznzei.supabase.co`** (403 explícito — não é o Supabase recusando, é a rede deste ambiente) e não tem rota de TCP direto pra fora dele (nem para o Postgres). Ou seja: **nenhuma tarefa que precise falar com um Supabase de verdade dá pra concluir ou verificar nesta sessão remota**, nem com o `hub-dev` hospedado nem com Docker local. Os comandos prontos (`login`/`link`/`db push`/`gen types`) foram passados para você rodar na sua máquina — ver `docs/decisoes.md` para os detalhes técnicos. Isso vale como novo entendimento geral do projeto, não só desta tarefa.
- **0.7 (tudo, exceto o item 1 [HUMANO])**: `src/app/(auth)/login/` (página + `login-form.tsx` + `actions.ts` com `signInWithPassword`, mensagem genérica "E-mail ou senha inválidos.") e `src/app/(auth)/login/mfa/` (desafia com `mfa.challenge` no carregamento da página, confirma com `mfa.verify`). `src/app/(app)/configuracoes/seguranca/`: cadastrar MFA (`mfa.enroll` + QR code + `mfa.challengeAndVerify`, via cliente do navegador — `src/lib/supabase/client.ts`), listar/remover fatores (`mfa.unenroll`), trocar senha (`auth.updateUser`, server action com Zod) e "Sair de todas as sessões" (`auth.signOut({ scope: "global" })`). `src/lib/safe-next.ts` valida o parâmetro `next` contra open redirect (testado). `requireOwner()` já exigia `aal2` desde a 0.6 — nada mudou lá. Não existe página de cadastro, como pedido.
- **0.7**: confirmei que `/login` responde 200 e renderiza o formulário completo mesmo sem nenhuma variável do Supabase configurada (a página só chama o Supabase dentro da server action, no envio do formulário — `curl` contra `next start` confirma). Já `/login/mfa` precisa do Supabase mesmo só para carregar (busca o fator de MFA e cria o desafio na própria página), então quebra sem Supabase configurado — isso é esperado, não é o mesmo tipo de bug corrigido na 0.6/0.9. **Não marcado como concluído**: o item 1 (criar o usuário do dono, desativar cadastro, habilitar MFA TOTP, configurar Site URL/Redirect URLs) é `[HUMANO]`, e o fluxo completo de login + código só pode ser testado de ponta a ponta com um Supabase real.
- **Marco — primeiro fim a fim em produção (2026-09-18)**: o dono criou o projeto `hub-dev`, aplicou a migration da 0.5 pelo SQL Editor do painel (não pela CLI — mesmo bloqueio de rede da nota acima), criou o usuário dono, desligou cadastro público, configurou Site URL/Redirect URLs (`null.prescrittomed.com.br` + `localhost:3000`), conectou o repositório na Vercel, configurou as variáveis de ambiente (as `NEXT_PUBLIC_*` tiveram que ser apagadas e recriadas como tipo "Config" — a Vercel não deixa uma variável criada como "Secret" ganhar prefixo público depois; a `.env.example` faz a Vercel já sugerir todas as chaves de todas as fases automaticamente na importação, então sobraram várias em branco, o que é esperado) e apontou o domínio (`null.prescrittomed.com.br`, registro CNAME pro `vercel-dns-017.com`). Login com senha funcionou em produção contra o Supabase de verdade, o layout (sidebar, tema, navegação) renderizou certo. Conferido por mim via Vercel: deployment de produção `READY`, domínio validado, zero erros nos logs do deployment atual (só tinha erros num deployment antigo, de antes das variáveis serem corrigidas). Isso confirma de verdade as tarefas 0.6 e 0.8, que antes só tinham passado em `lint`/`typecheck`/`test`/`build` sem confirmação real.
- **Decisão**: seguimos só com `hub-dev` para tudo (produção incluída) por enquanto — não criamos `hub-prod` separado. É uma simplificação deliberada para um projeto pessoal pequeno (ver decisão de 2026-09-17 sobre a organização nova no Supabase). Quando fizer sentido separar, criar `hub-prod` e repetir a configuração da Vercel apontando "Production" pra ele.
- **Pendente ainda**: cadastrar um fator MFA de verdade (`/configuracoes/seguranca`) e confirmar que o código passa a ser exigido no login (0.7); CI verde no GitHub (0.11 — ainda não existe branch `main`/PR); testes da fase (0.13, Playwright e RLS). Visual "feio" (sem shadcn/ui) registrado como pendência conhecida, adiada a pedido do dono — ver `docs/decisoes.md`.

## Fase 1 — Núcleo: espaços, tipos, itens, captura, inbox e busca

Documento: `docs/fase-01-nucleo.md`

- [ ] **1.1** Migration do núcleo
- [ ] **1.2** Definição de campos (schema dos tipos)
- [ ] **1.3** Onboarding no primeiro acesso
- [ ] **1.4** Espaços
- [ ] **1.5** Tipos de objeto e editor de campos
- [ ] **1.6** Itens: criar, ver e editar
- [ ] **1.7** Editor
- [ ] **1.8** Tags
- [ ] **1.9** Anexos
- [ ] **1.10** Captura rápida
- [ ] **1.11** Tokens de API
- [ ] **1.12** Bookmarklet, atalhos e PWA
- [ ] **1.13** Inbox
- [ ] **1.14** Busca
- [ ] **1.15** Visões
- [ ] **1.16** Paleta de comandos e atalhos
- [ ] **1.17** Histórico de versões
- [ ] **1.18** Testes da fase

Observações:


## Fase 2 — Mídia: fila de jobs, gravação, transcrição, resumo de reuniões e OCR

Documento: `docs/fase-02-midia-transcricao.md`

- [ ] **2.1** Migration
- [ ] **2.2** Motor de jobs
- [ ] **2.3** Cliente Claude e controle de custos
- [ ] **2.4** Provedor de transcrição
- [ ] **2.5** Gravação e envio de áudio
- [ ] **2.6** Pipeline de transcrição
- [ ] **2.7** Resumo de reuniões
- [ ] **2.8** Visualizador de transcrição
- [ ] **2.9** Extração de texto de documentos (OCR)
- [ ] **2.10** Captura de documentos pelo celular
- [ ] **2.11** Testes da fase

Observações:


## Fase 3 — Contatos, agenda, lembretes e compartilhamento

Documento: `docs/fase-03-agenda-lembretes-compartilhamento.md`

- [ ] **3.1** Migration
- [ ] **3.2** Criptografia
- [ ] **3.3** Contatos
- [ ] **3.4** Conexão com o Google Calendar
- [ ] **3.5** Sincronização de eventos
- [ ] **3.6** Agenda e planejador do dia
- [ ] **3.7** Nota de reunião a partir de evento
- [ ] **3.8** Motor de lembretes
- [ ] **3.9** Canais de envio
- [ ] **3.10** Regras automáticas de lembrete
- [ ] **3.11** Links de compartilhamento
- [ ] **3.12** Testes da fase

Observações:


## Fase 4 — Finanças

Documento: `docs/fase-04-financas.md`

- [ ] **4.1** Regras de dinheiro
- [ ] **4.2** Migration
- [ ] **4.3** Onboarding financeiro
- [ ] **4.4** Lançamentos
- [ ] **4.5** Importação de extratos (OFX e CSV)
- [ ] **4.6** Regras de categorização
- [ ] **4.7** Cartões de crédito e faturas
- [ ] **4.8** Contas a pagar e receber
- [ ] **4.9** Divisão de contas
- [ ] **4.10** Pix e página pública de cobrança
- [ ] **4.11** Orçamentos
- [ ] **4.12** Painel financeiro
- [ ] **4.13** Integração com o resto do sistema
- [ ] **4.14** Testes da fase

Observações:


## Fase 5 — Métodos, automações, vendas, estudos, projetos, listas e canvas

Documento: `docs/fase-05-metodos-automacoes.md`

- [ ] **5.1** Migration
- [ ] **5.2** Formato e instalador de packs
- [ ] **5.3** Motor de automações
- [ ] **5.4** Novas visões
- [ ] **5.5** Canvas
- [ ] **5.6** Pack: Vendas (CRM)
- [ ] **5.7** Pack: Estudos
- [ ] **5.8** Pack: Projetos e planejamentos
- [ ] **5.9** Pack: Listas
- [ ] **5.10** Pack: Mudanças e decisões
- [ ] **5.11** Pack: PARA e Zettelkasten (métodos de organização)
- [ ] **5.12** Diário e hábitos (opcional nesta fase)
- [ ] **5.13** Testes da fase

Observações:


## Fase 6 — Relatórios, busca semântica, "pergunte à sua base" e servidor MCP

Documento: `docs/fase-06-relatorios-ia-mcp.md`

- [ ] **6.1** Migration
- [ ] **6.2** Motor de relatórios
- [ ] **6.3** Relatórios personalizados
- [ ] **6.4** Execução, agendamento e entrega
- [ ] **6.5** Provedor de embeddings e indexação
- [ ] **6.6** Busca semântica
- [ ] **6.7** Pergunte à sua base
- [ ] **6.8** Assistentes de IA na organização
- [ ] **6.9** Servidor MCP
- [ ] **6.10** Testes da fase

Observações:


## Fase 7 — Operação: backup, exportação, importação de outros apps, monitoramento e manutenção

Documento: `docs/fase-07-operacao-backup-migracao.md`

- [ ] **7.1** Backup externo do banco
- [ ] **7.2** Backup dos arquivos (Storage)
- [ ] **7.3** Registro e teste de restauração
- [ ] **7.4** Exportação completa
- [ ] **7.5** Importação de outros apps
- [ ] **7.6** Monitoramento e alertas
- [ ] **7.7** Segurança contínua
- [ ] **7.8** Custos e economia
- [ ] **7.9** Desempenho e limpeza
- [ ] **7.10** Manual do sistema
- [ ] **7.11** Testes da fase

Observações:

