# Fase 4 — Finanças

**Objetivo:** controlar dinheiro pessoal e das empresas no mesmo lugar, separados por espaço: contas, cartões com faturas e parcelas, importação de extratos, categorização automática, contas a pagar e receber, orçamentos, divisão de contas com amigos/família/clientes e cobrança por Pix com lembretes.

**Entregável usável:** importar o extrato do mês, ver para onde foi o dinheiro, saber o que vence na semana e cobrar uma conta dividida enviando um link com Pix.

**Pré-requisito:** Fase 3 concluída (usa contatos, lembretes e links).

**Aviso de escopo:** este módulo é gestão financeira pessoal e gerencial. Não substitui contabilidade, emissão de nota fiscal ou obrigações fiscais das empresas.

---

## 4.1 Regras de dinheiro

`src/lib/money.ts` (com testes):

```ts
export type Cents = number;   // inteiro; usar Number.isSafeInteger nas validações

export function parseBRL(input: string): Cents;
// "1.234,56" → 123456 | "1234,5" → 123450 | "R$ -10" → -1000 | "1234.56" (formato de OFX) → 123456
// Lança erro para entradas ambíguas ou inválidas.

export function formatBRL(cents: Cents, opts?: { sign?: boolean }): string;
// 123456 → "R$ 1.234,56" (Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }))

export function sumCents(values: Cents[]): Cents;

export function splitEqual(total: Cents, n: number): Cents[];
// distribui centavos restantes 1 a 1 nos primeiros participantes; soma sempre = total

export function splitByWeights(total: Cents, weights: number[]): Cents[];
// método do maior resto; soma sempre = total
```

**Convenção de sinal:** em `fin_transactions.amount_cents`, **entrada é positiva e saída é negativa**. Em contas a pagar/receber, o valor é sempre positivo e a direção fica em `direction`.

## 4.2 Migration

`supabase migration new financas`

```sql
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
```

Incluir no seed do onboarding financeiro um conjunto de **categorias padrão** (editáveis):
- **Despesas:** Moradia (Aluguel, Condomínio, Energia, Água, Internet), Alimentação (Mercado, Restaurantes, Delivery), Transporte (Combustível, App de transporte, Manutenção), Saúde (Plano, Farmácia, Consultas), Educação, Lazer, Assinaturas, Compras, Impostos e taxas, Presentes, Pets, Empresa (Ferramentas, Serviços, Marketing), Outros.
- **Receitas:** Salário/Pró-labore, Vendas/Serviços, Reembolsos, Rendimentos, Outros.

## 4.3 Onboarding financeiro

Página `/financas/configurar` no primeiro acesso ao módulo:
1. Criar contas (nome, tipo, instituição, espaço, saldo inicial e data). Para cartões: limite, dia de fechamento, dia de vencimento e conta pagadora.
2. Revisar categorias padrão.
3. Cadastrar chaves Pix (opcional).
4. Ativar/desativar envio de dados financeiros para IA (padrão: desativado).

## 4.4 Lançamentos

Página `/financas/lancamentos`:
- Tabela com data, descrição, categoria, conta, contato, valor (verde/vermelho), status.
- Filtros: período (mês atual por padrão com setas), conta, espaço, categoria, contato, tipo, status, texto, sem categoria.
- Totais do filtro: entradas, saídas, resultado.
- Edição inline de categoria e descrição; seleção múltipla para categorizar em lote.
- **Formulário de lançamento:** despesa / receita / transferência; valor com máscara BRL; data; conta; categoria; contato; espaço (padrão = espaço da conta); descrição; tags; anexo (recibo); "Repetir" (cria recorrência); para cartão: **parcelado em N vezes**.
- **Transferência:** cria duas transações com o mesmo `transfer_group_id` (saída na origem, entrada no destino), `kind='transfer'`, sem categoria; excluídas dos relatórios de despesa/receita.
- **Parcelamento no cartão:** gerar N transações com `installment_group_id`, número e total, datas mensais a partir da compra; valor pela função `splitEqual`; cada parcela cai na fatura do seu período. Editar/excluir oferece "só esta" ou "esta e as próximas".
- Ao salvar sem categoria, aplicar regras (4.6).
- Captura rápida pelo celular: botão "Gasto rápido" (valor, descrição, categoria sugerida pela última usada com descrição parecida).

## 4.5 Importação de extratos (OFX e CSV)

Fluxo em `/financas/importar`:

1. Escolher conta e enviar arquivo (fica salvo como anexo).
2. **Detectar formato e codificação**: arquivos de bancos brasileiros podem vir em ISO-8859-1/Windows-1252; detectar e converter para UTF-8.
3. **OFX:** muitos arquivos são OFX 1.x no formato SGML (tags sem fechamento), outros XML. Implementar parser tolerante próprio em `features/finance/lib/ofx.ts` (ou lib madura, avaliando manutenção) que extrai de cada `<STMTTRN>`: `FITID`, `DTPOSTED` (formato `YYYYMMDD...`), `TRNAMT` (ponto decimal), `MEMO`/`NAME`. Faturas de cartão em OFX podem ter sinais invertidos: permitir "inverter sinais" na pré-visualização.
4. **CSV:** tela de mapeamento de colunas (data, descrição, valor, ou débito e crédito separados), formato de data (`dd/MM/yyyy`, `yyyy-MM-dd`), separador (`;` ou `,`), decimal (`,` ou `.`), linhas de cabeçalho a ignorar. Salvar o mapeamento na conta para próximas importações.
5. **Hash de deduplicação:** `sha256(account_id | FITID)` quando houver FITID; senão `sha256(account_id | data | valor | descrição normalizada | ordem do lançamento no mesmo dia com mesma descrição e valor)`.
6. **Pré-visualização:** tabela com status por linha (Novo, Duplicado, Erro), categoria sugerida pelas regras, possibilidade de desmarcar linhas e editar categoria.
7. **Conciliação com contas a pagar:** para cada linha nova, procurar `fin_bills` abertas da mesma direção com valor igual e vencimento em ±5 dias; sugerir vincular ("Parece o pagamento de: Aluguel").
8. Confirmar → inserir em lote, atualizar contadores de `fin_imports`.
9. **Desfazer importação** (até 7 dias): remove as transações daquele `import_id` que não foram editadas manualmente depois (ou pergunta).

Funções puras com testes: `parseOfx`, `parseCsv(mapping)`, `normalizeDescription`, `importHash`, `matchBills`.

## 4.6 Regras de categorização

- Página `/financas/regras`: lista por prioridade; criar/editar/testar ("Testar nos últimos 90 dias" mostra quantos lançamentos seriam afetados).
- **Aprender com correções:** ao mudar a categoria de um lançamento importado, oferecer "Sempre categorizar '<descrição normalizada>' como <categoria>?" → cria regra `contains`.
- Aplicação: primeira regra que casar por prioridade; incrementa `times_applied`.
- **Sugestão com IA (opcional, só se módulo de IA e envio de dados financeiros estiverem ativados):** para lançamentos ainda sem categoria após as regras, enviar apenas descrição, valor e data (sem nome da conta) e a lista de categorias, pedir JSON `{ id, category_id, confidence }`; aplicar só como sugestão (usuário confirma).

## 4.7 Cartões de crédito e faturas

- `features/finance/lib/statements.ts`: `statementFor(purchaseDate, closingDay, dueDay)` → `{ referenceMonth, periodStart, periodEnd, dueOn }`. Tratar meses sem o dia (ex.: fechamento 31 em fevereiro → último dia do mês).
- Ao criar transação em conta `credit_card`: calcular e criar (se não existir) a fatura e preencher `statement_id`.
- Página do cartão: fatura atual, próximas (parcelas futuras), anteriores; total, limite usado e disponível.
- **Fechamento:** job diário marca faturas com `period_end < hoje` como `closed` e cria/atualiza uma `fin_bills` a pagar com o total e vencimento (vinculada por `statement_id`).
- **Pagar fatura:** cria transação de saída na conta pagadora (`kind='card_payment'`) e transação de entrada no cartão com o mesmo `transfer_group_id`; atualiza `paid_cents` e status (`paid` ou `partial`).

## 4.8 Contas a pagar e receber

Página `/financas/contas`:
- Abas: A pagar, A receber, Pagas, Todas. Agrupamento: Atrasadas, Hoje, Esta semana, Este mês, Depois.
- Nova conta: descrição, valor, vencimento, contato, categoria, conta prevista, espaço, anexo (boleto/nota), linha digitável, Pix copia e cola, observações, repetir.
- **Extrair dados de boleto com IA** (opcional): enviar o PDF/imagem do boleto e pedir JSON com valor, vencimento, beneficiário e linha digitável, para o usuário revisar.
- **Marcar como paga/recebida:** valor pago (permite parcial), data, conta → cria transação vinculada (`bill_id`), atualiza `paid_cents`, status e `paid_at`.
- Botão copiar linha digitável / Pix.
- **Recorrências:** página `/financas/recorrencias`; job diário `generate_bills` cria contas até 60 dias à frente a partir de `fin_recurring` (índice único evita duplicar), avançando `next_due_on` com `rrule`. Para valores estimados, a conta nasce com o valor estimado e marcador "Confirmar valor".
- **Status atrasado** calculado na consulta (`status='open' and due_on < hoje`), sem job.
- Na agenda (fase 3), vencimentos aparecem como fonte de eventos.

**Regra de lembrete `bill_due`** (ativar a regra prevista na fase 3):
- Para mim: push/e-mail X dias antes e no dia das contas a pagar.
- Para contatos: nas contas **a receber** com contato com opt-in, mensagem de cobrança amigável X dias antes e no dia seguinte ao vencimento, com link de pagamento (4.10).

## 4.9 Divisão de contas

Página `/financas/dividir`:
- Lista de divisões abertas, saldos por pessoa ("Ana te deve R$ 85,00", "Você deve R$ 40,00 ao Pedro") e histórico.
- **Nova divisão:** título, valor total, data, quem pagou (eu ou contato), participantes (contatos + "Eu"), método:
  - Igual → `splitEqual`
  - Valores exatos → soma deve bater com o total (mostrar diferença em tempo real)
  - Porcentagem → soma 100% → `splitByWeights`
  - Cotas (ex.: 2 adultos, 1 criança) → `splitByWeights`
- Opções: vincular a um lançamento existente ou criar a transação da minha despesa total; anexar foto do recibo; grupo (ex.: "Viagem").
- **Lançamento contábil correto:** se eu paguei o total, a transação de saída é do total, e as partes dos outros viram valores a receber (não despesa minha). Nos relatórios, a despesa considerada é **a minha parte**. Implementar a lógica de "despesa efetiva" nos relatórios usando `fin_splits.transaction_id`.
- **Registrar pagamento de uma pessoa:** valor, data, conta → transação de entrada, atualiza `settled_cents` e `settled_at`; quando todas as partes estiverem quitadas, a divisão vira `settled`.
- **Grupo/viagem:** visão de acerto que calcula as transferências mínimas entre pessoas para zerar saldos (algoritmo guloso de maiores credores × maiores devedores), com testes.
- **Compartilhar com a pessoa:** link com permissão `settle` (4.10) e envio pelo WhatsApp.
- **Regra de lembrete `split_open`:** lembrete amigável para quem tem parte em aberto há X dias (padrão 7), no máximo a cada 7 dias, com link.

## 4.10 Pix e página pública de cobrança

**Gerador de Pix copia e cola (BR Code estático)** em `features/finance/lib/pix.ts`:

Estrutura TLV: cada campo = `ID (2 dígitos) + tamanho (2 dígitos) + valor`.

| ID | Campo | Valor |
|---|---|---|
| 00 | Payload Format Indicator | `01` |
| 26 | Merchant Account Information | subcampos: `00` = `br.gov.bcb.pix`; `01` = chave Pix; `02` = descrição (opcional, curta) |
| 52 | Merchant Category Code | `0000` |
| 53 | Moeda | `986` |
| 54 | Valor | ex.: `85.00` (ponto decimal; omitir para valor livre) |
| 58 | País | `BR` |
| 59 | Nome do recebedor | até 25 caracteres, sem acentos |
| 60 | Cidade | até 15 caracteres, sem acentos |
| 62 | Additional Data | subcampo `05` = txid (até 25 caracteres alfanuméricos; `***` quando não usado) |
| 63 | CRC16 | calculado sobre toda a string incluindo `6304`; CRC-16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), 4 dígitos hexadecimais maiúsculos |

```ts
export function buildPixPayload(input: {
  key: string; merchantName: string; merchantCity: string;
  amountCents?: number; txid?: string; description?: string;
}): string;
export function crc16ccitt(payload: string): string;
```

- Normalizar nome e cidade (remover acentos, maiúsculas).
- Chave telefone no formato `+55DDDNUMERO`.
- Gerar QR code com a lib `qrcode` (SVG ou data URL).
- **Validação obrigatória [HUMANO]:** gerar um código de R$ 0,01 e ler no app do banco antes de usar com terceiros. Incluir teste unitário do CRC com um valor de referência conhecido.
- Validar tamanho do campo 26 (máx. 99 caracteres).

**Página pública de cobrança `/p/[token]`** para recursos `split` e `bill` (reaproveitando a infraestrutura da fase 3):
- Mostra: título, data, valor total e **a parte da pessoa** (divisão) ou valor da conta a receber, vencimento, recibo (se permitido), status.
- QR Code Pix + botão "Copiar código Pix" + chave e nome do recebedor para conferência.
- Botão **"Já paguei"** (permissão `settle`): grava `claimed_paid_at` e notifica o dono por push. **Não marca como quitado**: o dono confirma ao ver o dinheiro na conta (ou pela conciliação da importação).
- Para divisões: o link é por participante (cada share tem seu link), para ninguém ver o valor de outra pessoa, a menos que a opção "mostrar divisão completa" esteja ativada.
- Mensagem padrão ao enviar pelo WhatsApp: "Oi {{nome}}! Segue sua parte de {{titulo}}: {{valor}}. Pix e detalhes: {{link}}".

## 4.11 Orçamentos

- Em cada categoria de despesa: orçamento mensal opcional.
- Página `/financas/orcamento`: barras por categoria (gasto efetivo × orçamento), cores 0–80% verde, 80–100% amarelo, >100% vermelho; filtro por espaço; mês navegável.
- Push quando uma categoria passar de 80% e de 100% no mês (uma vez cada).

## 4.12 Painel financeiro

Página `/financas`:
- Seletor de espaço (Todos, Pessoal, cada empresa) e de mês.
- Cartões: saldo total das contas (`include_in_totals`), entradas do mês, saídas efetivas do mês, resultado, faturas abertas, a receber em aberto, saldo de divisões.
- Gráfico de fluxo de caixa dos últimos 12 meses (entradas × saídas × resultado).
- Gastos por categoria no mês (barras horizontais) com comparação ao mês anterior.
- **Próximos 30 dias:** contas a pagar e receber, faturas e recorrências, com saldo projetado por dia (saldo atual + receitas previstas − despesas previstas).
- Maiores gastos do mês e lançamentos sem categoria (atalho para categorizar).
- Gráficos com `recharts`.

Consultas agregadas em funções SQL `security invoker` (ex.: `fin_monthly_summary(p_space_id, p_from, p_to)`, `fin_category_breakdown(...)`, `fin_cashflow_projection(...)`) para não trazer todas as transações ao cliente. Excluir `kind in ('transfer', 'card_payment')` de receitas e despesas.

## 4.13 Integração com o resto do sistema

- **Contatos:** aba Finanças no contato com contas a receber/pagar, lançamentos e saldo de divisões.
- **Itens:** ação "Registrar despesa/receita" e "Criar conta a receber" em qualquer item (ex.: oportunidade ganha na fase 5); painel "Financeiro" no item com lançamentos vinculados.
- **Busca:** lançamentos e contas aparecem na paleta de comandos com prefixo `$` (ex.: `$ mercado`).
- **Exportação:** lançamentos filtrados em CSV (separador `;`, decimal `,`, UTF-8 com BOM para abrir bem no Excel).

## 4.14 Testes da fase

**Unidade (obrigatórios):**
- `parseBRL`, `formatBRL`, `splitEqual`, `splitByWeights` (soma sempre igual ao total; testes com totais ímpares e muitos participantes)
- `statementFor` (fechamento no fim do mês, compra no dia do fechamento, virada de ano)
- Parcelamento (N parcelas, soma, datas)
- `parseOfx` com fixtures SGML e XML, codificação latin1, sinais
- `parseCsv` com mapeamentos diferentes
- `importHash` e deduplicação de lançamentos iguais no mesmo dia
- `matchBills`
- Aplicação de regras por prioridade
- `crc16ccitt` e `buildPixPayload` (tamanhos, campos opcionais, valor de referência)
- Algoritmo de acerto mínimo de grupo
- Projeção de fluxo de caixa

**Integração:**
- Importar o mesmo arquivo duas vezes → segunda importação só com duplicados.
- Pagar fatura atualiza status e não conta como despesa.
- Divisão paga por mim: relatório considera só a minha parte como despesa.
- `generate_bills` executado duas vezes não duplica contas.

**Segurança:**
- Link de uma parte da divisão não mostra as partes das outras pessoas.
- "Já paguei" não altera `settled_cents`.

**E2E:**
- Configurar conta → importar CSV → categorizar com regra → ver painel.
- Criar divisão → abrir link público → ver QR Pix → "Já paguei" → dono confirma → saldo zera.

## Definição de pronto da fase

- [ ] Contas, cartões com faturas e parcelas
- [ ] Lançamentos, transferências e recorrências
- [ ] Importação OFX/CSV com deduplicação, regras e conciliação
- [ ] Contas a pagar/receber com lembretes
- [ ] Divisão de contas com saldos, acerto de grupo e link público com Pix
- [ ] Orçamentos e painel com projeção
- [ ] Pix validado no app do banco
- [ ] Testes passando e `PROGRESSO.md` atualizado
