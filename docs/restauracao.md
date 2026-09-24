# Recuperação de desastre (fase 7.3)

Passo a passo pra recuperar o Hub inteiro **num projeto Supabase novo**, caso o
projeto atual seja perdido, corrompido ou a conta comprometida. Escrito pra ser
seguido sob pressão — cada passo é uma ação concreta, na ordem certa.

Pré-requisitos que você já deveria ter, de antes do desastre:
- Acesso ao bucket de backup (Cloudflare R2/Backblaze B2 — credenciais num
  gerenciador de senhas, nunca só no GitHub).
- A **chave privada `age`** (fora do repositório e do servidor — gerenciador de
  senhas).
- Acesso à conta da Vercel e ao provedor de DNS do domínio.

## 1. Criar o projeto Supabase novo

1. Crie um projeto novo no [dashboard do Supabase](https://supabase.com/dashboard).
   Anote a região (idealmente a mesma do projeto antigo, `sa-east-1` neste app)
   e a senha do banco.
2. Anote a nova `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (ou "publishable") e `SUPABASE_SERVICE_ROLE_KEY` (ou "secret") — Project
   Settings → API.
3. Habilite as extensões que o schema usa antes de restaurar (o `pg_restore`
   tenta criar de novo e ignora se já existirem, mas é mais rápido confirmar
   antes): `vector`, `pg_cron`, `pg_net`, `unaccent`. Painel → Database →
   Extensions, ou `create extension if not exists <nome>;` no SQL Editor.

## 2. Baixar e descriptografar o backup mais recente

Localmente (não precisa ser no GitHub Actions — ver a nota de segurança no
passo 3):

```bash
# Lista os objetos mais recentes em db/AAAA/MM/ no bucket de backup e baixa o mais novo.
aws s3 cp s3://<bucket>/db/<ano>/<mes>/hub-<data>.dump.age . \
  --endpoint-url <endpoint do bucket>

age -d -i <(echo "<CHAVE_PRIVADA_AGE>") -o hub.dump hub-<data>.dump.age
```

## 3. Restaurar no projeto novo

**Nota de segurança:** a string de conexão abaixo tem a senha do banco novo —
rode isso no seu computador, não cole num lugar público.

```bash
pg_restore --no-owner --no-privileges \
  -d "postgresql://postgres:<SENHA>@db.<novo-ref>.supabase.co:5432/postgres" \
  hub.dump
```

Se `pg_restore` reclamar de role/schema que já existe (normal, o Supabase já
cria alguns por padrão), ignore — o que importa é `items`/`fin_transactions`/
`contacts`/etc. aparecerem depois.

Confira:

```sql
select count(*) from public.items;
select count(*) from public.fin_transactions;
select count(*) from public.contacts;
select max(created_at) from public.items;
```

## 4. Restaurar o Storage (arquivos)

```bash
rclone copy dst:<bucket-backup>/storage src:attachments \
  --s3-no-check-bucket
```

(mesma configuração de remotes `src`/`dst` do workflow `storage-backup.yml` —
`src` agora aponta pro Storage do projeto **novo**, com as credenciais S3 que
você gera nele: Storage → Settings → S3 Connection.)

Se o bucket `attachments` não existir ainda no projeto novo, crie-o primeiro
(privado) pelo dashboard ou `supabase storage create attachments`.

## 5. Reconfigurar variáveis de ambiente

Na Vercel (Project Settings → Environment Variables), atualize pra todo
ambiente (Production/Preview/Development):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (passo 1).
- Todas as outras variáveis continuam as mesmas (`.env.example` tem a lista
  completa) — elas não dependem do projeto Supabase em si, só a conexão muda.

No GitHub (Settings → Secrets and variables → Actions), atualize
`SUPABASE_DB_URL` (string de conexão do pooler do projeto novo) e, se você
recriou o bucket de Storage, `SUPABASE_STORAGE_S3_*`.

Redeploy a aplicação (novo deploy na Vercel, ou `git commit --allow-empty` +
push) pra pegar as variáveis novas.

## 6. DNS

Se o domínio apontava pro projeto Supabase antigo em algum lugar (normalmente
não aponta — o app fala com o Supabase via API, não via DNS direto), confira o
Site URL/Redirect URLs em Authentication → URL Configuration no projeto novo
(precisa bater com o domínio de produção, senão o login quebra).

O domínio da Vercel (`APP_URL`) não muda — só o projeto Supabase por trás.

## 7. Verificação final

- Login funciona (`/login`).
- MFA do dono ainda pede o código certo (o fator MFA é dado do `auth` —
  restaurado junto no passo 3, já que o dump inclui o schema `auth`).
- `/inbox`, `/financas`, `/contatos` mostram dados de verdade, não vazios.
- Um anexo antigo abre (`/itens/<id>` com anexo) — confirma que o passo 4
  funcionou.
- `pg_cron`/jobs: confira `select * from cron.job;` — os agendamentos internos
  do Postgres precisam ser recriados (o dump do schema `public` não inclui
  `cron.job`, que vive no schema `cron`); o app já recria os `job_schedules`
  dele mesmo (tabela `public.job_schedules`, restaurada no dump) na primeira
  visita às páginas que chamam `ensure*Schedule` — mas confirme rodando
  `/api/jobs/tick` manualmente uma vez com o `CRON_SECRET`.

## Registrar o teste

Todo teste de restauração (de verdade, num desastre real, ou o mensal do
workflow `restore-test.yml`) deveria terminar com uma linha nova em
`backup_runs` (`kind = 'restore_test'`) — o workflow já faz isso sozinho via
`POST /api/ops/backup-report`; se você restaurar manualmente fora do
workflow, registre à mão pelo SQL Editor do projeto novo (ou peça pro Claude
Code registrar por você).
