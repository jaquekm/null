-- =========================================================
-- CONTAS
-- =========================================================
create table public.fin_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,     -- Pessoal, Empresa X...
  name text not null,
  kind text not null check (kind in ('checking', 'savings', 'credit_card', 'cash', 'investment', 'wallet', 'other')),
  institution text,
  currency text not null default 'BRL',
  opening_balance_cents bigint not null default 0,
  opening_date date not null default current_date,
  credit_limit_cents bigint,          -- cartão
  closing_day smallint check (closing_day between 1 and 31),   -- cartão
  due_day smallint check (due_day between 1 and 31),           -- cartão
  payment_account_id uuid references public.fin_accounts(id) on delete set null,  -- conta que paga a fatura
  color text,
  include_in_totals boolean not null default true,
  position double precision not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- CATEGORIAS
-- =========================================================
create table public.fin_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id uuid references public.fin_categories(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  icon text,
  color text,
  monthly_budget_cents bigint,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, parent_id, name)
);

-- =========================================================
-- FATURAS DE CARTÃO
-- =========================================================
create table public.fin_card_statements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.fin_accounts(id) on delete cascade,
  reference_month date not null,            -- primeiro dia do mês de vencimento
  period_start date not null,
  period_end date not null,                 -- data de fechamento
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'closed', 'paid', 'partial')),
  paid_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (account_id, reference_month)
);

-- =========================================================
-- IMPORTAÇÕES
-- =========================================================
create table public.fin_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.fin_accounts(id) on delete cascade,
  attachment_id uuid references public.attachments(id) on delete set null,
  format text not null check (format in ('ofx', 'csv')),
  csv_mapping jsonb,
  rows_total int not null default 0,
  rows_imported int not null default 0,
  rows_duplicate int not null default 0,
  rows_error int not null default 0,
  status text not null default 'preview' check (status in ('preview', 'imported', 'undone')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- RECORRÊNCIAS
-- =========================================================
create table public.fin_recurring (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,
  description text not null,
  direction text not null check (direction in ('payable', 'receivable')),
  amount_cents bigint not null check (amount_cents > 0),
  amount_is_estimate boolean not null default false,   -- conta de luz: valor varia
  category_id uuid references public.fin_categories(id) on delete set null,
  account_id uuid references public.fin_accounts(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  rrule text not null,
  next_due_on date not null,
  ends_on date,
  remind_days_before smallint default 3,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- CONTAS A PAGAR E RECEBER
-- =========================================================
create table public.fin_bills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,
  direction text not null check (direction in ('payable', 'receivable')),
  description text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  category_id uuid references public.fin_categories(id) on delete set null,
  account_id uuid references public.fin_accounts(id) on delete set null,   -- conta prevista
  amount_cents bigint not null check (amount_cents > 0),
  paid_cents bigint not null default 0,
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'partial', 'paid', 'canceled')),
  recurring_id uuid references public.fin_recurring(id) on delete set null,
  statement_id uuid references public.fin_card_statements(id) on delete set null,
  attachment_id uuid references public.attachments(id) on delete set null,  -- boleto, nota
  barcode text,
  pix_code text,
  item_id uuid references public.items(id) on delete set null,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fin_bills_due_idx on public.fin_bills (owner_id, status, due_on);
create unique index fin_bills_recurring_due_idx on public.fin_bills (recurring_id, due_on) where recurring_id is not null;

-- =========================================================
-- LANÇAMENTOS
-- =========================================================
create table public.fin_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.fin_accounts(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,
  category_id uuid references public.fin_categories(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  description text not null,
  original_description text,                 -- como veio do banco
  amount_cents bigint not null check (amount_cents <> 0),
  occurred_on date not null,
  status text not null default 'cleared' check (status in ('pending', 'cleared', 'reconciled')),
  kind text not null default 'normal' check (kind in ('normal', 'transfer', 'card_payment', 'adjustment')),
  transfer_group_id uuid,                     -- as duas pernas da transferência compartilham este id
  statement_id uuid references public.fin_card_statements(id) on delete set null,
  installment_group_id uuid,
  installment_number smallint,
  installment_total smallint,
  bill_id uuid references public.fin_bills(id) on delete set null,
  import_id uuid references public.fin_imports(id) on delete set null,
  import_hash text,
  external_id text,                           -- FITID do OFX
  item_id uuid references public.items(id) on delete set null,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fin_tx_account_date_idx on public.fin_transactions (account_id, occurred_on desc);
create index fin_tx_owner_date_idx on public.fin_transactions (owner_id, occurred_on desc);
create index fin_tx_category_idx on public.fin_transactions (category_id, occurred_on);
create unique index fin_tx_import_hash_idx on public.fin_transactions (account_id, import_hash) where import_hash is not null;
create index fin_tx_description_trgm_idx on public.fin_transactions using gin (description extensions.gin_trgm_ops);

-- =========================================================
-- REGRAS DE CATEGORIZAÇÃO
-- =========================================================
create table public.fin_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  match_field text not null default 'description' check (match_field in ('description', 'original_description')),
  match_type text not null default 'contains' check (match_type in ('contains', 'starts_with', 'equals', 'regex')),
  pattern text not null,
  account_id uuid references public.fin_accounts(id) on delete cascade,   -- null = todas
  amount_min_cents bigint,
  amount_max_cents bigint,
  set_category_id uuid references public.fin_categories(id) on delete cascade,
  set_contact_id uuid references public.contacts(id) on delete set null,
  set_description text,
  set_space_id uuid references public.spaces(id) on delete set null,
  priority int not null default 100,
  times_applied int not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- DIVISÃO DE CONTAS
-- =========================================================
create table public.fin_splits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  total_cents bigint not null check (total_cents > 0),
  occurred_on date not null default current_date,
  paid_by_contact_id uuid references public.contacts(id) on delete set null,  -- null = eu paguei
  method text not null default 'equal' check (method in ('equal', 'exact', 'percent', 'shares')),
  transaction_id uuid references public.fin_transactions(id) on delete set null,
  group_label text,                          -- ex.: "Viagem Floripa"
  attachment_id uuid references public.attachments(id) on delete set null,   -- foto do recibo
  status text not null default 'open' check (status in ('open', 'settled', 'canceled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fin_split_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  split_id uuid not null references public.fin_splits(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,   -- null = minha parte
  weight numeric,                              -- percent/shares
  share_cents bigint not null check (share_cents >= 0),
  settled_cents bigint not null default 0,
  claimed_paid_at timestamptz,                 -- a pessoa marcou "já paguei" pelo link
  settled_at timestamptz,
  settlement_transaction_id uuid references public.fin_transactions(id) on delete set null,
  unique (split_id, contact_id)
);

-- Saldo por contato: positivo = o contato me deve; negativo = eu devo ao contato
create or replace view public.fin_contact_balances
with (security_invoker = true)
as
select
  s.owner_id,
  sh.contact_id,
  sum(sh.share_cents - sh.settled_cents)::bigint as balance_cents
from public.fin_splits s
join public.fin_split_shares sh on sh.split_id = s.id
where s.status <> 'canceled' and s.paid_by_contact_id is null and sh.contact_id is not null
group by s.owner_id, sh.contact_id
union all
select
  s.owner_id,
  s.paid_by_contact_id as contact_id,
  -sum(sh.share_cents - sh.settled_cents)::bigint as balance_cents
from public.fin_splits s
join public.fin_split_shares sh on sh.split_id = s.id
where s.status <> 'canceled' and s.paid_by_contact_id is not null and sh.contact_id is null
group by s.owner_id, s.paid_by_contact_id;
-- Consumir agregando por contact_id (sum) na aplicação ou em outra view.

-- =========================================================
-- CONFIGURAÇÕES DE PIX
-- =========================================================
create table public.fin_pix_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,                        -- "Pessoal", "Empresa X"
  key_type text not null check (key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  key_value text not null,
  merchant_name text not null check (char_length(merchant_name) <= 25),
  merchant_city text not null check (char_length(merchant_city) <= 15),
  space_id uuid references public.spaces(id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Saldo por conta
create or replace view public.fin_account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.owner_id,
  a.opening_balance_cents + coalesce(sum(t.amount_cents) filter (where t.status <> 'pending'), 0)::bigint as balance_cents,
  coalesce(sum(t.amount_cents) filter (where t.status = 'pending'), 0)::bigint as pending_cents
from public.fin_accounts a
left join public.fin_transactions t on t.account_id = a.id and t.occurred_on >= a.opening_date
group by a.id;

-- Triggers
create trigger fin_accounts_updated_at before update on public.fin_accounts for each row execute function public.set_updated_at();
create trigger fin_recurring_updated_at before update on public.fin_recurring for each row execute function public.set_updated_at();
create trigger fin_bills_updated_at before update on public.fin_bills for each row execute function public.set_updated_at();
create trigger fin_transactions_updated_at before update on public.fin_transactions for each row execute function public.set_updated_at();
create trigger fin_splits_updated_at before update on public.fin_splits for each row execute function public.set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['fin_accounts','fin_categories','fin_card_statements','fin_imports','fin_recurring',
    'fin_bills','fin_transactions','fin_rules','fin_splits','fin_split_shares','fin_pix_keys']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
