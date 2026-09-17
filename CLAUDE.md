@AGENTS.md

# CLAUDE.md — Hub (sistema pessoal de organização)

Este arquivo é lido automaticamente pelo Claude Code. Ele define o contexto do projeto e as regras que valem para TODAS as fases.

## O que é o projeto

Um sistema web **de uso pessoal, com um único usuário (o dono)**, que substitui várias assinaturas:
notas e captura rápida, documentação, reuniões com gravação e transcrição, OCR de documentos, agenda,
lembretes para contatos (clientes, amigos, família), finanças (contas, cartões, divisão de contas, Pix),
vendas/CRM, planos de estudo com flashcards, projetos, listas, relatórios e IA sobre a própria base.

O sistema é **configurável**: espaços, tipos de objeto, campos, visões e automações são dados criados
pelo usuário, não código fixo. Módulos com lógica própria (finanças, agenda, lembretes, mídia, relatórios)
são código.

Terceiros (clientes, família) **nunca criam conta**. Eles recebem links de compartilhamento com
permissão limitada e prazo de validade.

- Documentação detalhada: `docs/00-visao-geral.md` e `docs/fase-XX-*.md`
- Progresso: `docs/PROGRESSO.md`

## Stack

- **Next.js** (App Router, Server Components, Server Actions, Route Handlers), TypeScript em modo `strict`
- **Tailwind CSS** + **shadcn/ui** (componentes em `src/components/ui`), ícones `lucide-react`
- **Supabase**: Postgres, Auth (e-mail + senha + MFA TOTP), Storage, `pg_cron`, `pg_net`, `pgvector`, Vault
- Cliente Supabase: `@supabase/ssr` e `@supabase/supabase-js`
- Validação: **Zod** em toda entrada (formulários, server actions, route handlers, webhooks, respostas de IA)
- Editor: **Tiptap**
- Tabelas: **TanStack Table**. Drag and drop: **dnd-kit**
- Datas: `date-fns` + `date-fns-tz`. Recorrência: `rrule`
- IA: `@anthropic-ai/sdk` (Claude). Embeddings e transcrição por provedores atrás de interfaces
- Testes: **Vitest** (unidade/integração) e **Playwright** (e2e)
- Hospedagem: **Vercel**, em um subdomínio do domínio do dono
- Gerenciador de pacotes: **pnpm**

Ao instalar dependências, use as versões estáveis atuais e confira a documentação oficial, porque APIs
mudam entre versões (ex.: no Next.js 16+ o `middleware.ts` passou a se chamar `proxy.ts`).

## Comandos

```bash
pnpm dev              # desenvolvimento
pnpm build            # build de produção
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest
pnpm test:e2e         # Playwright
pnpm db:types         # gera src/lib/supabase/database.types.ts a partir do banco local
supabase start        # Supabase local (Docker)
supabase migration new <nome>   # cria migration
supabase db reset     # recria banco local aplicando todas as migrations + seed
```

## Estrutura de pastas

```
src/
  app/
    (auth)/login/                 # login e verificação MFA
    (app)/                        # área autenticada (layout com sidebar)
      inbox/  espacos/[slug]/  itens/[id]/  capturar/  buscar/
      agenda/  contatos/  financas/  relatorios/  estudos/  perguntar/
      configuracoes/
    p/[token]/                    # páginas PÚBLICAS de compartilhamento (sem login)
    api/
      capture/  jobs/tick/  webhooks/  google/  mcp/  health/
  components/
    ui/                           # shadcn/ui
    layout/  editor/  views/  shared/
  features/<modulo>/              # um diretório por módulo
    actions.ts                    # server actions ('use server')
    queries.ts                    # leituras no servidor
    schemas.ts                    # Zod
    components/
    lib/                          # regras de negócio puras (testáveis)
  lib/
    supabase/ server.ts client.ts admin.ts database.types.ts
    env.ts  money.ts  dates.ts  crypto.ts  tokens.ts  result.ts
    ai/  transcription/  messaging/  embeddings/  jobs/
packs/                            # pacotes de métodos (JSON) — fase 5
supabase/
  migrations/  seed.sql  tests/
tests/e2e/
docs/
```

## Convenções obrigatórias

### Idioma
- **Código, nomes de tabelas, colunas, funções e variáveis em inglês.**
- **Interface, mensagens, textos e rotas visíveis em português do Brasil.**
- Comentários podem ser em português.

### Banco de dados
- Toda alteração de schema é feita **somente por migration** (`supabase migration new`). Nunca altere o banco pelo dashboard.
- Toda tabela de dados do usuário tem `owner_id uuid not null references auth.users(id) on delete cascade`.
- Toda tabela tem **RLS habilitado** com política de dono:
  ```sql
  alter table public.x enable row level security;
  create policy "owner_all" on public.x for all to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));
  ```
- `owner_id` tem `default auth.uid()`. **Em código que roda com service role (jobs, webhooks, API por token), `auth.uid()` é nulo: preencha `owner_id` explicitamente.**
- Toda tabela tem `created_at timestamptz not null default now()` e, se editável, `updated_at` com o trigger `public.set_updated_at()`.
- IDs: `uuid primary key default gen_random_uuid()`.
- Datas e horas: `timestamptz` (armazenado em UTC). Datas sem hora (vencimentos, aniversários): `date`.
- Fuso de exibição padrão: `America/Sao_Paulo` (vem de `user_settings.timezone`).
- **Dinheiro: sempre inteiro em centavos (`bigint`, colunas terminadas em `_cents`). Nunca `float`/`numeric` para valores monetários no código.**
- Exclusão de itens do usuário é lógica (`deleted_at`), exceto quando indicado.
- Após criar migration: `supabase db reset` e `pnpm db:types`.

### Segurança
- `SUPABASE_SERVICE_ROLE_KEY` (ou chave secreta) **só** em `src/lib/supabase/admin.ts`, que importa `server-only`. Nunca em componentes cliente.
- Rotas públicas (`/p/*`, `/api/webhooks/*`, `/api/jobs/tick`, `/api/capture`, `/api/mcp`) validam segredo, assinatura ou token **antes** de qualquer leitura.
- Comparação de segredos com `crypto.timingSafeEqual`.
- Tokens (API, compartilhamento) são guardados **apenas como hash SHA-256**. O valor puro aparece uma única vez para o usuário.
- Tokens OAuth de terceiros são criptografados com AES-256-GCM (`src/lib/crypto.ts`, chave `ENCRYPTION_KEY`).
- Nada de dados financeiros ou de contatos é enviado a provedores de IA sem o módulo estar habilitado nas configurações.
- Nunca commitar `.env*` (exceto `.env.example`).

### Código
- Server actions retornam `Result<T>`: `{ ok: true, data } | { ok: false, error: string, fieldErrors? }` (`src/lib/result.ts`). Não lance exceções para o cliente.
- Regras de negócio (cálculos, parsers, recorrência, divisão de contas, Pix) ficam em funções **puras** em `features/*/lib` e **têm testes**.
- Variáveis de ambiente são lidas somente via `src/lib/env.ts` (validado com Zod).
- Provedores externos (transcrição, embeddings, mensagens, e-mail) ficam atrás de uma **interface**, com implementação trocável por variável de ambiente.
- Acessibilidade básica: labels, foco visível, navegação por teclado.
- Mobile first: tudo deve funcionar em tela de celular.

## Como trabalhar neste repositório (regras para o Claude Code)

1. Antes de começar uma tarefa, leia `docs/00-visao-geral.md` e o documento da fase correspondente.
2. Trabalhe **uma tarefa por vez** (ex.: "1.6"). Não avance para a próxima sem concluir os critérios de aceite.
3. Tarefas marcadas **[HUMANO]** exigem ação do dono (criar contas, DNS, chaves). Pare e peça, explicando exatamente o que ele precisa fazer.
4. Ao terminar uma tarefa: rode `pnpm lint`, `pnpm typecheck` e `pnpm test`. Corrija tudo antes de declarar concluído.
5. Atualize `docs/PROGRESSO.md` marcando a tarefa e anotando decisões ou desvios do plano.
6. Se precisar desviar do plano (outra lib, outro schema), explique o motivo e registre em `docs/decisoes.md`.
7. Não adicione dependências fora da stack sem justificar.
8. Trabalhe no projeto Supabase **local ou de desenvolvimento**. Nunca rode migrations em produção sem o dono pedir.
9. Commits pequenos, em português, no formato `tipo(escopo): descrição` (ex.: `feat(financas): importação OFX`).
