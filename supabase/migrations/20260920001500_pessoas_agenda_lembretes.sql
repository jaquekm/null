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

-- =========================================================
-- Campo "Participantes" da Reunião vira tipo `contact` (3.1, texto final da
-- tarefa). `object_types.fields` é por dono (upsert no onboarding, não uma
-- linha global) — atualiza tanto quem já onboardou (esta linha) quanto o
-- seed usado em novos onboardings (`system-types.ts`, atualizado junto no
-- mesmo commit). Guardado por `@>` pra ser idempotente e não tocar em nada
-- que o dono já tenha customizado manualmente pra outro tipo.
-- =========================================================
update public.object_types
set fields = (
  select jsonb_agg(
    case
      when field->>'key' = 'participantes' and field->>'type' = 'text'
        then (field - 'description') || jsonb_build_object('type', 'contact')
      else field
    end
  )
  from jsonb_array_elements(fields) as field
)
where slug = 'reuniao'
  and is_system = true
  and fields @> '[{"key": "participantes", "type": "text"}]'::jsonb;
