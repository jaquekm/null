# Fase 3 — Contatos, agenda, lembretes e compartilhamento

**Objetivo:** ter contatos centralizados, agenda sincronizada com o Google Calendar, planejamento do dia, lembretes automáticos para você e para clientes, amigos e família (WhatsApp, e-mail e push), e links seguros para compartilhar itens com quem não tem conta.

**Entregável usável:** ver a agenda e as tarefas do dia juntas, criar a nota de uma reunião a partir do evento, agendar lembretes para outras pessoas e compartilhar uma nota por link.

**Pré-requisito:** Fase 2 concluída (usa a fila de jobs).

---

## 3.1 Migration

`supabase migration new pessoas_agenda_lembretes`

```sql
-- =========================================================
-- CONTATOS
-- =========================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  nickname text,                               -- como chamar na mensagem
  relationship text not null default 'other'
    check (relationship in ('client', 'family', 'friend', 'supplier', 'partner', 'colleague', 'other')),
  company text,
  role text,
  phone_e164 text,                             -- +5511999998888
  email text,
  birthday date,
  address jsonb,
  notes text,
  avatar_path text,
  space_id uuid references public.spaces(id) on delete set null,
  preferred_channel text not null default 'whatsapp' check (preferred_channel in ('whatsapp', 'email')),
  whatsapp_opt_in boolean not null default false,
  email_opt_in boolean not null default false,
  consent_at timestamptz,
  consent_source text,                         -- 'verbal', 'whatsapp', 'formulario', 'contrato'
  opted_out_at timestamptz,
  properties jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_owner_name_idx on public.contacts using gin (name extensions.gin_trgm_ops);
create unique index contacts_phone_idx on public.contacts (owner_id, phone_e164) where phone_e164 is not null;
create index contacts_email_idx on public.contacts (owner_id, lower(email));

create table public.item_contacts (
  item_id uuid not null references public.items(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text,                                   -- 'participant', 'client', 'responsible'
  primary key (item_id, contact_id)
);
create index item_contacts_contact_idx on public.item_contacts (contact_id);

-- =========================================================
-- GOOGLE CALENDAR
-- =========================================================
create table public.google_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  google_email text not null,
  refresh_token_encrypted text not null,       -- AES-256-GCM
  access_token_encrypted text,
  access_token_expires_at timestamptz,
  scopes text[] not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, google_email)
);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  connection_id uuid not null references public.google_connections(id) on delete cascade,
  external_id text not null,
  name text not null,
  color text,
  timezone text,
  is_primary boolean not null default false,
  sync_enabled boolean not null default true,
  space_id uuid references public.spaces(id) on delete set null,
  sync_token text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, external_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  calendar_id uuid references public.calendars(id) on delete cascade,
  external_id text,
  recurring_event_external_id text,
  title text not null default '(sem título)',
  description text,
  location text,
  conference_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  timezone text,
  status text not null default 'confirmed' check (status in ('confirmed', 'tentative', 'cancelled')),
  attendees jsonb not null default '[]'::jsonb,   -- [{ email, name, response }]
  item_id uuid references public.items(id) on delete set null,   -- nota da reunião
  remote_etag text,
  remote_updated_at timestamptz,
  local_dirty boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, external_id)
);
create index events_range_idx on public.events (owner_id, starts_at, ends_at);

-- =========================================================
-- LEMBRETES
-- =========================================================
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  message_template text not null,              -- suporta variáveis {{nome}}, {{data}}, {{hora}}, {{valor}}, {{link}}
  channel text not null check (channel in ('whatsapp', 'email', 'push', 'auto')),   -- auto = canal preferido do contato
  recipient_type text not null check (recipient_type in ('me', 'contacts')),
  contact_ids uuid[] not null default '{}',
  send_at timestamptz not null,                -- próxima ocorrência
  rrule text,                                  -- recorrência (RFC 5545), null = única
  timezone text not null default 'America/Sao_Paulo',
  ends_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'paused', 'completed', 'canceled')),
  source_type text,                            -- 'manual', 'event', 'bill', 'birthday', 'item', 'split', 'rule'
  source_id uuid,
  rule_id uuid,
  item_id uuid references public.items(id) on delete set null,
  variables jsonb not null default '{}'::jsonb,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminders_due_idx on public.reminders (status, send_at) where status = 'scheduled';
create unique index reminders_source_idx on public.reminders (owner_id, source_type, source_id, rule_id)
  where source_id is not null;

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  occurrence_at timestamptz not null,
  channel text not null,
  destination text,                            -- telefone/e-mail no momento do envio
  rendered_message text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  skip_reason text,                            -- 'opt_out', 'quiet_hours', 'no_destination', 'rate_limit'
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index reminder_deliveries_once_idx
  on public.reminder_deliveries (reminder_id, coalesce(contact_id, '00000000-0000-0000-0000-000000000000'::uuid), occurrence_at);

create table public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('event_before', 'birthday', 'bill_due', 'item_date_field', 'split_open')),
  config jsonb not null default '{}'::jsonb,   -- ex.: { minutesBefore: 1440, onlyRelationships: ['client'] }
  channel text not null default 'auto',
  recipient_type text not null default 'contacts',
  message_template text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- =========================================================
-- COMPARTILHAMENTO
-- =========================================================
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('item', 'list', 'split', 'report', 'bill')),
  resource_id uuid not null,
  token_hash text not null unique,
  token_prefix text not null,
  permission text not null default 'view' check (permission in ('view', 'comment', 'check', 'settle')),
  include_attachments boolean not null default false,
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  label text,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index share_links_resource_idx on public.share_links (resource_type, resource_id);

create table public.share_link_views (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  share_link_id uuid not null references public.share_links(id) on delete cascade,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.share_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  share_link_id uuid not null references public.share_links(id) on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) <= 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Triggers updated_at
create trigger contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger google_connections_updated_at before update on public.google_connections for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();
create trigger reminder_deliveries_updated_at before update on public.reminder_deliveries for each row execute function public.set_updated_at();
create trigger reminder_rules_updated_at before update on public.reminder_rules for each row execute function public.set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['contacts','item_contacts','google_connections','calendars','events','reminders',
    'reminder_deliveries','reminder_rules','push_subscriptions','share_links','share_link_views','share_comments']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
```

Atualizar o campo `participantes` do tipo Reunião para o tipo `contact` e habilitar o tipo de campo `contact` no editor de tipos.

## 3.2 Criptografia

`src/lib/crypto.ts` (server-only):

```ts
// AES-256-GCM com chave de ENCRYPTION_KEY (32 bytes base64)
// Formato: base64(iv 12 bytes) + '.' + base64(authTag 16 bytes) + '.' + base64(ciphertext)
export function encrypt(plain: string): string;
export function decrypt(payload: string): string;
export function sha256Hex(value: string): string;
export function safeEqual(a: string, b: string): boolean;
export function hmacSha256Hex(secret: string, body: string): string;
```

Testes: ida e volta; payload adulterado lança erro.

## 3.3 Contatos

Página `/contatos`:
- Lista com busca, filtro por relação, empresa, espaço e opt-in.
- Detalhe `/contatos/[id]`: dados, consentimento, itens ligados (reuniões, oportunidades, notas), eventos com o contato, lembretes, histórico de mensagens enviadas (`reminder_deliveries`) e, na fase 4, saldo financeiro.
- Criar/editar com normalização do telefone para E.164 usando `libphonenumber-js` (padrão BR).
- **Consentimento:** marcar opt-in exige escolher a origem (`consent_source`); grava `consent_at`. Tela explica que lembretes para terceiros só são enviados com opt-in.
- **Importação:** vCard (`.vcf`, exportado do Google Contatos ou iPhone) e CSV com mapeamento de colunas; detectar duplicados por telefone ou e-mail e oferecer mesclar.
- Mesclar dois contatos (move vínculos e mantém o mais completo).
- Menção de contatos no editor com `@` (Mention separado do de itens), gravando em `item_contacts`.

## 3.4 Conexão com o Google Calendar

**[HUMANO] Google Cloud:**
1. Criar projeto e ativar **Google Calendar API**.
2. Tela de consentimento OAuth: tipo externo, adicionar o próprio e-mail como usuário de teste.
3. Escopos: `https://www.googleapis.com/auth/calendar.events` e `https://www.googleapis.com/auth/calendar.calendarlist.readonly` (confirmar nomes na documentação atual), mais `openid email`.
4. Credencial "Aplicativo da Web" com URIs de redirecionamento: `http://localhost:3000/api/google/callback` e `https://app.seudominio.com.br/api/google/callback`.
5. **Importante:** apps no status "Em teste" costumam ter refresh tokens que expiram em cerca de 7 dias. Para uso contínuo, publicar o app ("Em produção"). Por ser de uso pessoal, é possível aceitar a tela de "app não verificado" no seu próprio login. Confirmar as regras atuais do Google.

**Rotas:**
- `GET /api/google/connect` (autenticada): gera `state` aleatório e `code_verifier` (PKCE), guarda em cookie httpOnly assinado por 10 min, redireciona com `access_type=offline` e `prompt=consent`.
- `GET /api/google/callback`: valida `state`, troca o código, busca o e-mail, grava `google_connections` com tokens criptografados, busca a lista de calendários e grava `calendars` (principal com `sync_enabled=true`, demais desligados), enfileira `calendar_sync`.

`src/lib/google/client.ts`: `getAccessToken(connectionId)` renova com refresh token quando faltarem menos de 5 min; se o Google responder `invalid_grant`, marcar a conexão como `revoked` e notificar o dono por push/e-mail "Reconecte o Google Calendar".

Página `/configuracoes/integracoes`: conectar, desconectar (revogar token no Google e apagar dados), escolher calendários sincronizados e o espaço de cada um.

## 3.5 Sincronização de eventos

**Job `calendar_sync`** (periódico a cada 10 min via `job_schedules`, e manual pelo botão "Sincronizar agora"):

Para cada calendário com `sync_enabled`:
1. Se não houver `sync_token`: sincronização completa (`events.list` paginado) e salvar o `nextSyncToken` da última página.
2. Se houver: sincronização incremental com `syncToken`. Se a API responder **410 Gone**, apagar o token e refazer a sincronização completa.
3. Eventos `cancelled` → marcar `status='cancelled'` (manter por 30 dias, depois apagar).
4. Upsert por `(calendar_id, external_id)`.
5. **Recorrência:** verificar na documentação quais parâmetros são compatíveis com `syncToken`. Preferir receber instâncias expandidas (`singleEvents=true`) se compatível; caso contrário, guardar o evento principal e expandir as ocorrências localmente com `rrule` ao consultar um intervalo. Registrar a escolha em `docs/decisoes.md`.
6. Ligar `attendees` a contatos pelo e-mail (preencher `item_contacts` quando existir nota de reunião).

**Escrita (app → Google):**
- Criar, editar e excluir eventos pelo app chama a API imediatamente. Em falha de rede, marcar `local_dirty=true` e enfileirar `calendar_push`.
- Conflito: se o `etag` remoto mudou, o Google vence e o usuário é avisado.
- Opção ao criar evento: adicionar videoconferência (Google Meet) via `conferenceData`, se disponível na API.

## 3.6 Agenda e planejador do dia

**Página `/agenda`** (FullCalendar React, plugins de licença MIT, ou implementação própria):
- Visões dia, semana, mês e lista; navegação e "Hoje".
- Fontes exibidas (cada uma liga/desliga): eventos do Google; itens com campo `date`/`datetime` (ex.: prazos de tarefas); lembretes; na fase 4, vencimentos de contas.
- Clicar em horário vazio → criar evento (título, horário, calendário, convidados a partir de contatos, descrição, Meet).
- Arrastar e redimensionar eventos → atualiza no Google.
- Fuso de exibição de `user_settings.timezone`.

**Página `/agenda/hoje` (Planejador do dia):**
- Coluna esquerda: linha do tempo do dia com eventos.
- Coluna direita: tarefas com prazo hoje ou atrasadas, itens fixados e lembretes do dia.
- **Arrastar tarefa para um horário** cria bloco de tempo (evento no calendário principal com link para o item).
- Resumo no topo: "3 reuniões, 5 tarefas, 2 contas vencendo".
- No mobile, as colunas viram abas.

## 3.7 Nota de reunião a partir de evento

- No evento: botão **"Criar nota da reunião"** → item tipo Reunião com título do evento, `data`, participantes (contatos encontrados pelos e-mails), link do Meet e o template do tipo; grava `events.item_id`.
- Se já existir, o botão vira "Abrir nota".
- Configuração opcional: criar notas automaticamente X minutos antes dos eventos com convidados (job `prepare_meeting_notes` periódico).
- Na nota: seção "Última reunião com estes participantes" com link e ações pendentes da anterior.
- Botão "Gravar reunião" já disponível (fase 2).

## 3.8 Motor de lembretes

**Recorrência** (`src/features/reminders/lib/recurrence.ts`):
- Usar `rrule` calculando no fuso do lembrete (`timezone`) e convertendo para UTC.
- `nextOccurrence(rrule, timezone, after: Date): Date | null`.
- Presets na UI: uma vez, diariamente, dias úteis, semanalmente (escolher dias), mensalmente (dia X ou "última sexta"), anualmente, personalizado.

**Templates** (`renderTemplate(template, vars)`):
- Variáveis: `{{nome}}` (apelido ou primeiro nome), `{{nome_completo}}`, `{{data}}` (dd/MM/yyyy), `{{hora}}` (HH:mm), `{{dia_semana}}`, `{{valor}}` (R$ formatado), `{{link}}`, `{{titulo}}`, e as de `reminders.variables`.
- Variável desconhecida → erro de validação ao salvar.
- Pré-visualização com um contato de exemplo.

**Job `dispatch_reminders`** (periódico, a cada minuto):
1. Buscar lembretes `scheduled` com `send_at <= now()` (limite 50).
2. Para cada destinatário (o dono ou cada contato):
   - Definir canal (`auto` → `preferred_channel` do contato).
   - Verificar: opt-in do canal, `opted_out_at`, destino existe, **horário silencioso** (padrão 21h–8h para terceiros; mover para as 8h do dia seguinte), limite de 3 mensagens por contato por dia.
   - Inserir `reminder_deliveries` (o índice único impede envio duplicado da mesma ocorrência). Se não passar nas verificações: `status='skipped'` com motivo.
   - Enviar pelo provedor do canal e atualizar status e `provider_message_id`.
3. Calcular próxima ocorrência: se houver, atualizar `send_at`; senão, `status='completed'`. Atualizar `last_sent_at`.

**Página `/lembretes`:**
- Abas: Próximos, Recorrentes, Enviados (entregas), Com falha.
- Criar/editar: título, para quem (eu / contatos), canal, mensagem com variáveis e pré-visualização, quando, recorrência, término.
- Pausar, retomar, cancelar, "Enviar agora" (com confirmação).
- Criar lembrete a partir de qualquer item ("Lembrar sobre isto") e de contatos.

## 3.9 Canais de envio

`src/lib/messaging/types.ts`:

```ts
export interface MessageChannel {
  send(input: {
    deliveryId: string;
    to: string;
    text: string;
    subject?: string;
    template?: { name: string; language: string; variables: string[] };
  }): Promise<{ providerMessageId?: string }>;
}
```

**E-mail (Resend):**
- **[HUMANO]** Verificar o domínio (ou subdomínio de envio) no Resend e adicionar os registros DNS (SPF, DKIM e, recomendado, DMARC).
- Templates com React Email: layout simples, texto da mensagem, rodapé com "Não quer mais receber? Clique aqui" (link `/p/opt-out/[token]`).
- `reply_to` com o e-mail pessoal do dono.

**WhatsApp (via N8N):**
- O app faz `POST` para `N8N_WHATSAPP_WEBHOOK_URL` com corpo `{ deliveryId, to, text, template }` e header `X-Hub-Signature: <hmac sha256 do corpo com N8N_WEBHOOK_SECRET>`.
- O fluxo no N8N **[HUMANO]** valida a assinatura, envia pela API oficial do WhatsApp (Cloud API) ou pela integração existente, e chama de volta `POST /api/webhooks/messaging` com `{ deliveryId, status, providerMessageId, error }`, também assinado.
- Mensagens recebidas com "SAIR", "PARAR" ou "STOP" → o N8N chama o webhook com `{ type: 'opt_out', phone }` e o app marca `opted_out_at` e desliga os opt-ins.
- **Regras do WhatsApp oficial:** mensagens iniciadas pela empresa fora da janela de 24 h exigem **templates aprovados** pela Meta, e há cobrança por conversa/mensagem. Criar os templates necessários (ex.: `lembrete_generico` com variáveis) e mapear no app. Evitar bibliotecas não oficiais de WhatsApp Web: há risco de banimento do número.
- Documentar em `docs/n8n-whatsapp.md` o fluxo esperado (nós e payloads) para o dono montar.

**Push (para o dono):**
- Gerar chaves VAPID (`web-push generate-vapid-keys`).
- Em `/configuracoes/notificacoes`: botão "Ativar notificações neste dispositivo" → `PushManager.subscribe` → salvar em `push_subscriptions`. Listar dispositivos e remover.
- Service worker trata o evento `push` (título, corpo, URL) e `notificationclick` (abre a URL).
- Envio com a lib `web-push`; se o endpoint responder 404/410, remover a assinatura.
- No iOS, push só funciona com o PWA instalado na tela inicial.

**Notificações para o dono** (configuráveis): lembretes pessoais, comentários em links compartilhados, falhas de jobs, reconexão do Google, contas vencendo (fase 4).

## 3.10 Regras automáticas de lembrete

Página `/lembretes/regras` com regras prontas para ativar e ajustar:

| Regra | Comportamento |
|---|---|
| Lembrete de reunião para participantes | X horas antes de eventos com convidados que são contatos com opt-in (filtrar por relação, ex.: só clientes). Mensagem com data, hora e link do Meet |
| Lembrete de reunião para mim | Push X minutos antes, com link para a nota da reunião |
| Aniversários | No dia, às 9h: push para mim com sugestão de mensagem; opcionalmente envio direto ao contato |
| Campo de data de item | Para um tipo e campo escolhidos (ex.: Tarefa.prazo), lembrar X dias antes |
| Vencimento de contas | Criada na fase 4 |
| Divisão de contas em aberto | Criada na fase 4 |

**Job `generate_reminders`** (a cada 15 min e após `calendar_sync`): para cada regra ativa, encontrar as fontes nos próximos 30 dias e fazer upsert de `reminders` usando o índice `(source_type, source_id, rule_id)`. Se a fonte mudou de horário, atualizar `send_at`; se foi cancelada, cancelar o lembrete.

## 3.11 Links de compartilhamento

**Criação** (diálogo "Compartilhar" em itens; depois em listas, divisões e relatórios):
- Permissão: `view` (ver), `comment` (ver e comentar), `check` (marcar itens de checklist — útil para listas de compras), `settle` (fase 4).
- Validade: 1 dia, 7 dias, 30 dias (padrão), 90 dias, sem validade (com aviso).
- Incluir anexos: sim/não.
- Senha opcional (hash com `scrypt` do Node).
- Contato (opcional) para registrar a quem foi enviado.
- Token de 32 bytes `base64url`; salvar `sha256`; mostrar URL `APP_URL/p/<token>` com botões copiar, **enviar por WhatsApp** (abre `https://wa.me/<telefone>?text=`) e enviar por e-mail.
- Lista de links ativos no item e em `/configuracoes/compartilhamentos`, com visualizações, último acesso e revogar.

**Página pública `/p/[token]`:**
1. Calcular hash e buscar com cliente admin; se não existir, revogado ou expirado → página "Link inválido ou expirado" (mesma resposta para todos os casos).
2. Se tiver senha: formulário; após acertar, cookie httpOnly com escopo no caminho, válido por 12 h. Limitar tentativas.
3. Buscar **apenas** o recurso referenciado, montando um objeto com campos permitidos (título, conteúdo renderizado, propriedades visíveis, anexos se permitido). Nunca retornar `owner_id`, tags internas, backlinks ou outros itens.
4. Renderizar o conteúdo Tiptap em HTML no servidor (`generateHTML`) e sanitizar.
5. Links internos `[[...]]` aparecem como texto simples (sem URL).
6. Anexos por URL assinada de 10 minutos.
7. Registrar visualização (`view_count`, `last_viewed_at`, `share_link_views` com hash do IP).
8. Cabeçalhos: `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`.
9. Limite de taxa por IP.
10. Layout limpo, sem navegação do app, com rodapé discreto.

**Permissões extras:**
- `comment`: formulário (nome + mensagem) → `share_comments` + notificação push para o dono. Comentários aparecem no item para o dono.
- `check`: checkboxes de listas de tarefas clicáveis; a alteração é feita por server action que valida token e permissão e altera **somente** o estado do checkbox no JSON.

**Opt-out público** `/p/opt-out/[token]`: token assinado (HMAC) com `contact_id` e canal; confirma e grava `opted_out_at`.

## 3.12 Testes da fase

**Unidade:**
- `encrypt`/`decrypt`, `safeEqual`, `hmacSha256Hex`.
- `nextOccurrence` com presets, fim de mês, anual em 29/02, fuso `America/Sao_Paulo` e um fuso com horário de verão.
- `renderTemplate` com todas as variáveis e variável desconhecida.
- Regras de envio: opt-out, sem destino, horário silencioso, limite diário.
- Normalização de telefone.
- Parser de vCard.

**Integração (mocks de Google, Resend, N8N):**
- `dispatch_reminders` executado duas vezes para a mesma ocorrência não envia duas vezes.
- Sincronização incremental e tratamento de 410.
- Webhook de mensagens com assinatura inválida → 401; opt-out atualiza contato.
- `generate_reminders` cria, atualiza e cancela conforme mudanças no evento.

**Segurança:**
- `/p/[token]` com token inválido, revogado e expirado dá a mesma resposta.
- Página pública não expõe campos proibidos (teste que procura `owner_id` e títulos de outros itens no HTML).
- Permissão `check` não permite alterar outro conteúdo.

**E2E:**
- Criar contato com opt-in → criar lembrete com pré-visualização → executar tick → entrega registrada (mock).
- Compartilhar item → abrir link em contexto anônimo → comentar → comentário aparece para o dono.

## Definição de pronto da fase

- [x] Contatos com consentimento, importação e mesclagem
- [x] Google Calendar conectado com sincronização nos dois sentidos
- [x] Agenda e planejador do dia com tarefas e blocos de tempo
- [x] Nota de reunião a partir de evento
- [x] Lembretes únicos e recorrentes por WhatsApp, e-mail e push, sem duplicidade
- [x] Regras automáticas (reuniões, aniversários, campos de data)
- [x] Links de compartilhamento com validade, senha, comentários e revogação
- [x] `docs/n8n-whatsapp.md` escrito
- [x] Testes passando e `PROGRESSO.md` atualizado
