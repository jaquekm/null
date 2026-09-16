# Fase 0 — Fundação

**Objetivo:** projeto criado, login seguro só para o dono, deploy funcionando no subdomínio, banco versionado por migrations e CI rodando.

**Entregável usável:** acessar `https://app.seudominio.com.br`, entrar com e-mail, senha e código MFA, e ver o layout vazio do app.

---

## 0.1 [HUMANO] Contas e serviços

O dono deve criar ou preparar:

1. **GitHub:** repositório privado `hub`.
2. **Supabase:** dois projetos, `hub-dev` e `hub-prod`, na mesma região (preferir São Paulo, `sa-east-1`, se disponível). Guardar URL, chave pública (anon/publishable), chave secreta (service role/secret) e senha do banco de cada um.
3. **Vercel:** conta conectada ao GitHub.
4. **Domínio:** acesso ao painel de DNS. Escolher o subdomínio (ex.: `app`).
5. **Docker Desktop** instalado (para Supabase local) e **Supabase CLI**.
6. **2FA ativado** em GitHub, Supabase, Vercel e no provedor de domínio.

Critério de aceite: o dono confirma que tem todos os acessos.

## 0.2 Criar o projeto Next.js

```bash
pnpm create next-app@latest hub --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd hub
pnpm dlx shadcn@latest init
pnpm add @supabase/supabase-js @supabase/ssr zod date-fns date-fns-tz lucide-react next-themes server-only
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom @playwright/test prettier prettier-plugin-tailwindcss
```

Componentes shadcn iniciais: `button input label card dialog dropdown-menu sheet sonner form select textarea tabs tooltip command popover badge separator skeleton avatar switch checkbox`.

Scripts em `package.json`:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"
}
```

Configurar `tsconfig.json` com `"strict": true` e `"noUncheckedIndexedAccess": true`.

Criar a estrutura de pastas descrita no `CLAUDE.md` (pastas vazias com `.gitkeep`).

Critério de aceite: `pnpm dev` abre a página inicial; `pnpm lint`, `pnpm typecheck` e `pnpm test` passam.

## 0.3 Variáveis de ambiente

Criar `src/lib/env.ts` que valida com Zod e separa variáveis de servidor e públicas. Variáveis ausentes em fases futuras devem ser **opcionais** até a fase que as usa.

`.env.example`:

```bash
# App
APP_URL=http://localhost:3000
OWNER_EMAIL=
CRON_SECRET=                      # string aleatória longa (openssl rand -base64 48)
ENCRYPTION_KEY=                   # 32 bytes em base64 (openssl rand -base64 32)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # ou chave "publishable"
SUPABASE_SERVICE_ROLE_KEY=        # ou chave "secret" — só no servidor

# Fase 2
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=                  # definir com o modelo atual desejado
TRANSCRIPTION_PROVIDER=
TRANSCRIPTION_API_KEY=
TRANSCRIPTION_WEBHOOK_SECRET=
AI_MONTHLY_BUDGET_USD=20

# Fase 3
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=                       # ex.: Hub <avisos@seudominio.com.br>
MESSAGING_PROVIDER=n8n
N8N_WHATSAPP_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:voce@seudominio.com.br

# Fase 6
EMBEDDINGS_PROVIDER=
EMBEDDINGS_API_KEY=
EMBEDDINGS_MODEL=
EMBEDDINGS_DIM=

# Fase 7
SENTRY_DSN=
```

Critério de aceite: iniciar o app sem uma variável obrigatória gera erro claro dizendo qual falta.

## 0.4 Supabase local e CLI

```bash
supabase init
supabase start            # sobe Postgres, Auth, Storage locais
supabase link --project-ref <ref-do-hub-dev>
```

Documentar no `README.md` como iniciar o ambiente local e onde ficam as chaves locais (`supabase status`).

Critério de aceite: `supabase start` e `supabase db reset` funcionam.

## 0.5 Migration inicial

`supabase migration new fundacao`

```sql
-- Extensões (no Supabase ficam no schema "extensions")
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Trigger genérico de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Configurações do usuário
create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  default_space_id uuid,
  onboarding_completed_at timestamptz,
  modules jsonb not null default '{"finance": true, "ai": false, "messaging": false}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "owner_all" on public.user_settings for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
```

Depois: `supabase db reset` e `pnpm db:types`.

Critério de aceite: tabela criada localmente e tipos gerados.

## 0.6 Clientes Supabase

Arquivos:

- `src/lib/supabase/server.ts`: `createClient()` com `createServerClient` do `@supabase/ssr` e cookies do Next (`cookies()` de `next/headers`).
- `src/lib/supabase/client.ts`: `createClient()` com `createBrowserClient`.
- `src/lib/supabase/admin.ts`: `import 'server-only'`; cliente com a chave secreta, `auth: { persistSession: false }`. Exportar `createAdminClient()`.
- Todos tipados com `Database` de `database.types.ts`.

**Middleware/proxy** (`src/middleware.ts` ou `src/proxy.ts`, conforme a versão do Next):

- Atualiza a sessão do Supabase em toda requisição (padrão da documentação do `@supabase/ssr`).
- Rotas liberadas sem login: `/login`, `/p/*`, `/api/health`, `/api/webhooks/*`, `/api/jobs/tick`, `/api/capture`, `/api/mcp`, `/manifest.webmanifest`, `/sw.js`, ícones e arquivos estáticos.
- Qualquer outra rota sem sessão redireciona para `/login?next=<rota>`.

Criar `src/lib/result.ts`:

```ts
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: string, fieldErrors?: Record<string, string[]>): Result<never> =>
  ({ ok: false, error, fieldErrors });
```

Criar `src/lib/auth.ts` com `requireOwner()`:
1. Busca o usuário no servidor com `supabase.auth.getUser()` (não confiar só em `getSession`).
2. Se não houver usuário: redireciona para `/login`.
3. Se `user.email !== env.OWNER_EMAIL`: faz sign out e redireciona para `/login`.
4. Verifica o nível de autenticação (AAL) com `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. Se o usuário tem MFA cadastrado e a sessão não está em `aal2`, redireciona para `/login/mfa`.
5. Retorna `{ supabase, user }`.

Toda server action e página autenticada chama `requireOwner()`.

Critério de aceite: acessar `/inbox` sem login redireciona; rotas públicas listadas respondem sem login.

## 0.7 Autenticação com MFA

1. **[HUMANO]** No Supabase (dev e prod): criar o usuário do dono em Authentication → Users; **desativar novos cadastros** (Allow new users to sign up = off); habilitar MFA TOTP; configurar Site URL e Redirect URLs (localhost e o subdomínio).
2. Página `/login`: e-mail e senha (`signInWithPassword`), mensagens de erro genéricas ("E-mail ou senha inválidos").
3. Página `/login/mfa`: pede o código de 6 dígitos (`mfa.challenge` + `mfa.verify`).
4. Página `/configuracoes/seguranca`:
   - Cadastrar MFA (`mfa.enroll` com tipo `totp`) mostrando QR code e código manual, confirmando com um código.
   - Listar e remover fatores.
   - Trocar senha.
   - Botão "Sair de todas as sessões".
5. Após o dono ativar o MFA, `requireOwner()` passa a exigir `aal2`.
6. Não existe página de cadastro.

Critério de aceite: login com senha + código funciona; sem o código, as páginas não abrem; tentativa com outro e-mail (se existisse) é bloqueada.

## 0.8 Layout da aplicação

- `src/app/(app)/layout.tsx` chama `requireOwner()`.
- **Desktop:** sidebar recolhível com Inbox, Buscar, Agenda, Finanças, Contatos, Relatórios, Estudos, lista de espaços (placeholder nesta fase), Configurações.
- **Mobile:** barra inferior com Inbox, Buscar, botão central "+" (captura), Agenda, Menu.
- Topo: busca rápida (placeholder), botão de captura, menu do usuário.
- Tema claro/escuro/sistema com `next-themes`.
- `<html lang="pt-BR">`, fonte legível, `Toaster` (sonner) para feedback.
- Páginas vazias com estado "Em breve" para os módulos futuros.

Critério de aceite: layout responsivo em 375 px e em desktop, tema alternando.

## 0.9 Cabeçalhos de segurança

Em `next.config`:

- `X-Robots-Tag: noindex, nofollow` em todas as rotas.
- `Referrer-Policy: strict-origin-when-cross-origin` (e `no-referrer` em `/p/*`).
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY` (ou `frame-ancestors 'none'` via CSP).
- `Permissions-Policy`: liberar `microphone=(self)` (gravação na fase 2); negar câmera e geolocalização se não usadas.
- CSP básica. Deixar documentado como ajustar quando adicionar domínios externos.
- `public/robots.txt` com `Disallow: /`.

Critério de aceite: cabeçalhos visíveis nas respostas (verificar com `curl -I`).

## 0.10 Deploy no subdomínio

1. **[HUMANO]** Importar o repositório na Vercel.
2. Configurar variáveis de ambiente: **Production** aponta para `hub-prod`; **Preview/Development** para `hub-dev`.
3. **[HUMANO]** Adicionar o domínio `app.seudominio.com.br` no projeto da Vercel e criar o registro `CNAME` indicado no DNS.
4. Aplicar migrations em produção: `supabase link --project-ref <hub-prod>` e `supabase db push` (**somente com autorização do dono**).
5. Conferir no Supabase prod: Site URL = `https://app.seudominio.com.br`, cadastro desativado, MFA ativo.

Critério de aceite: login com MFA funcionando em produção via HTTPS no subdomínio.

## 0.11 CI

`.github/workflows/ci.yml` em pull requests e pushes na `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. (Opcional) Subir Supabase local no runner e rodar `supabase db reset` para validar migrations.

Migrations em produção **não** rodam automaticamente nesta fase.

Critério de aceite: CI verde na `main`.

## 0.12 Health check e página de erro

- `GET /api/health` → `{ status: "ok", time, version }` (versão via `VERCEL_GIT_COMMIT_SHA`). Não expor detalhes internos.
- `app/error.tsx` e `app/not-found.tsx` em português.

## 0.13 Testes da fase

- Vitest: teste de `env.ts` (falha com variável ausente) e de `result.ts`.
- Playwright: login com usuário de teste no Supabase local (sem MFA) e acesso ao layout.
- Script `supabase/tests/rls_check.sql` (ou teste Vitest com cliente anônimo) confirmando que um cliente anônimo não lê `user_settings`.

## Definição de pronto da fase

- [ ] App em produção no subdomínio com HTTPS
- [ ] Login com senha + MFA; cadastro público desativado
- [ ] Migrations versionadas e aplicadas em dev e prod
- [ ] CI verde
- [ ] `README.md` explicando setup local e deploy
- [ ] `docs/PROGRESSO.md` atualizado
