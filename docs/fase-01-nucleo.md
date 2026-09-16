# Fase 1 — Núcleo: espaços, tipos, itens, captura, inbox e busca

**Objetivo:** substituir o app de notas. Capturar qualquer coisa de qualquer lugar, organizar em espaços e tipos configuráveis, ligar itens entre si, anexar arquivos, buscar e ver o histórico de versões.

**Entregável usável:** uso diário para notas, tarefas simples, documentos, links e ideias, no celular e no computador.

**Pré-requisito:** Fase 0 concluída.

---

## 1.1 Migration do núcleo

`supabase migration new nucleo`

```sql
-- =========================================================
-- ESPAÇOS
-- =========================================================
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null,
  description text,
  icon text,                      -- emoji ou nome de ícone lucide
  color text,                     -- token de cor (ex.: 'emerald')
  position double precision not null default 0,
  ai_enabled boolean not null default true,   -- permite enviar conteúdo deste espaço à IA (fase 6)
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

-- =========================================================
-- TIPOS DE OBJETO
-- fields: array JSON de definições de campo (ver 1.2)
-- =========================================================
create table public.object_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,  -- null = disponível em todos os espaços
  name text not null,
  plural_name text,
  slug text not null,
  icon text,
  color text,
  fields jsonb not null default '[]'::jsonb,
  template jsonb,                 -- conteúdo Tiptap inicial ao criar item deste tipo
  title_template text,            -- ex.: 'Reunião {{date}}'
  default_view text not null default 'list',
  is_system boolean not null default false,   -- tipos criados pelo sistema/pack (não excluir sem confirmação)
  pack_key text,                  -- preenchido quando veio de um pack (fase 5)
  position double precision not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

-- =========================================================
-- ITENS
-- =========================================================
create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,   -- null enquanto está no inbox
  type_id uuid references public.object_types(id) on delete set null,
  parent_id uuid references public.items(id) on delete set null,
  title text not null default '',
  content jsonb,                  -- documento Tiptap (JSON)
  content_text text not null default '',   -- texto puro extraído do content (para busca e IA)
  extra_text text not null default '',     -- texto de anexos, OCR e transcrições (fase 2)
  properties jsonb not null default '{}'::jsonb,
  status text not null default 'inbox' check (status in ('inbox', 'active', 'archived')),
  source text,                    -- 'quick', 'web', 'share', 'api', 'voice', 'import', 'automation'
  source_url text,
  icon text,
  cover_path text,
  pinned boolean not null default false,
  position double precision not null default 0,
  search tsvector,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_owner_status_idx on public.items (owner_id, status) where deleted_at is null;
create index items_space_idx on public.items (space_id) where deleted_at is null;
create index items_type_idx on public.items (type_id) where deleted_at is null;
create index items_parent_idx on public.items (parent_id);
create index items_updated_idx on public.items (owner_id, updated_at desc);
create index items_search_idx on public.items using gin (search);
create index items_title_trgm_idx on public.items using gin (title extensions.gin_trgm_ops);
create index items_properties_idx on public.items using gin (properties jsonb_path_ops);

-- =========================================================
-- TAGS
-- =========================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,             -- sempre minúsculo, sem '#'
  color text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.item_tags (
  item_id uuid not null references public.items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);
create index item_tags_tag_idx on public.item_tags (tag_id);

-- =========================================================
-- LINKS ENTRE ITENS (bidirecionais pela consulta)
-- =========================================================
create table public.links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id uuid not null references public.items(id) on delete cascade,
  target_id uuid not null references public.items(id) on delete cascade,
  kind text not null default 'mention',   -- 'mention' (no texto), 'relation' (campo), 'canvas' (fase 5)
  field_key text,                          -- quando kind = 'relation'
  created_at timestamptz not null default now(),
  unique (source_id, target_id, kind, field_key),
  check (source_id <> target_id)
);
create index links_target_idx on public.links (target_id);

-- =========================================================
-- ANEXOS
-- =========================================================
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  storage_path text not null unique,       -- {owner_id}/{item_id|avulso}/{uuid}-{nome}
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text,
  width int,
  height int,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);
create index attachments_item_idx on public.attachments (item_id);
create index attachments_sha_idx on public.attachments (owner_id, sha256);

-- =========================================================
-- VERSÕES
-- =========================================================
create table public.item_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  title text not null,
  content jsonb,
  properties jsonb not null,
  reason text not null default 'auto' check (reason in ('auto', 'manual', 'restore', 'ai')),
  label text,
  created_at timestamptz not null default now()
);
create index item_versions_item_idx on public.item_versions (item_id, created_at desc);

-- =========================================================
-- VISÕES SALVAS
-- =========================================================
create table public.views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  type_id uuid references public.object_types(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('list', 'table', 'kanban', 'calendar', 'gallery', 'timeline')),
  config jsonb not null default '{}'::jsonb,   -- filtros, ordenação, agrupamento, colunas visíveis
  is_default boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- TOKENS DE API PESSOAIS (captura, atalhos, N8N, MCP)
-- =========================================================
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  token_prefix text not null,              -- primeiros 8 caracteres, para identificar na lista
  token_hash text not null unique,         -- sha256 hex do token
  scopes text[] not null default array['capture']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- TRIGGERS
-- =========================================================
create trigger spaces_updated_at before update on public.spaces
  for each row execute function public.set_updated_at();
create trigger object_types_updated_at before update on public.object_types
  for each row execute function public.set_updated_at();
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger views_updated_at before update on public.views
  for each row execute function public.set_updated_at();

-- Vetor de busca (português, sem acentos)
create or replace function public.items_search_update()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.search :=
    setweight(to_tsvector('portuguese', unaccent(coalesce(new.title, ''))), 'A') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(new.content_text, ''))), 'B') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(new.properties::text, ''))), 'C') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(new.extra_text, ''))), 'D');
  return new;
end;
$$;

create trigger items_search before insert or update of title, content_text, properties, extra_text
  on public.items for each row execute function public.items_search_update();

-- Snapshot automático de versão (no máximo 1 a cada 10 minutos por item)
create or replace function public.items_version_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
begin
  if (old.title is distinct from new.title)
     or (old.content is distinct from new.content)
     or (old.properties is distinct from new.properties) then
    select max(created_at) into last_at from public.item_versions where item_id = old.id;
    if last_at is null or last_at < now() - interval '10 minutes' then
      insert into public.item_versions (owner_id, item_id, title, content, properties, reason)
      values (old.owner_id, old.id, old.title, old.content, old.properties, 'auto');
    end if;
  end if;
  return new;
end;
$$;

create trigger items_version before update on public.items
  for each row execute function public.items_version_snapshot();

-- =========================================================
-- BUSCA
-- =========================================================
create or replace function public.search_items(
  q text,
  p_space_id uuid default null,
  p_type_id uuid default null,
  p_status text default null,
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  id uuid, title text, snippet text, space_id uuid, type_id uuid,
  status text, rank real, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with query as (
    select websearch_to_tsquery('portuguese', unaccent(q)) as tsq
  )
  select
    i.id,
    i.title,
    ts_headline('portuguese', i.content_text || ' ' || i.extra_text, query.tsq,
      'MaxFragments=2, MaxWords=18, MinWords=6, StartSel=<mark>, StopSel=</mark>') as snippet,
    i.space_id, i.type_id, i.status,
    (ts_rank(i.search, query.tsq) + similarity(i.title, q))::real as rank,
    i.updated_at
  from public.items i, query
  where i.deleted_at is null
    and (p_space_id is null or i.space_id = p_space_id)
    and (p_type_id is null or i.type_id = p_type_id)
    and (p_status is null or i.status = p_status)
    and (i.search @@ query.tsq or i.title % q)
  order by rank desc, i.updated_at desc
  limit p_limit offset p_offset;
$$;

-- Backlinks
create or replace function public.item_backlinks(p_item_id uuid)
returns table (id uuid, title text, kind text, field_key text, updated_at timestamptz)
language sql stable security invoker set search_path = public
as $$
  select i.id, i.title, l.kind, l.field_key, i.updated_at
  from public.links l
  join public.items i on i.id = l.source_id
  where l.target_id = p_item_id and i.deleted_at is null
  order by i.updated_at desc;
$$;

-- =========================================================
-- RLS
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['spaces','object_types','items','tags','item_tags','links','attachments','item_versions','views','api_tokens']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- =========================================================
-- STORAGE
-- =========================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

Adicionar FK de `user_settings.default_space_id` para `spaces(id) on delete set null`.

Critério de aceite: `supabase db reset` sem erros; tipos gerados; teste confirmando que cliente anônimo não lê `items`.

## 1.2 Definição de campos (schema dos tipos)

`src/features/types/schemas.ts`:

```ts
export const fieldTypes = [
  'text', 'long_text', 'number', 'money', 'percent', 'date', 'datetime',
  'select', 'multi_select', 'checkbox', 'url', 'email', 'phone',
  'rating', 'relation', 'contact', 'file', 'duration'
] as const;

export const selectOptionSchema = z.object({
  id: z.string(),                 // id estável (nanoid), não muda ao renomear
  label: z.string().min(1),
  color: z.string().optional(),
});

export const fieldDefinitionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),   // imutável depois de criado
  label: z.string().min(1),
  type: z.enum(fieldTypes),
  required: z.boolean().default(false),
  description: z.string().optional(),
  options: z.array(selectOptionSchema).optional(),      // select / multi_select
  relationTypeId: z.string().uuid().optional(),         // relation
  multiple: z.boolean().optional(),                     // relation / contact / file
  currency: z.string().default('BRL').optional(),       // money
  min: z.number().optional(),
  max: z.number().optional(),
  hidden: z.boolean().optional(),
  showInCard: z.boolean().optional(),                   // aparece no card do kanban
});
```

Regras de armazenamento em `items.properties`:

| Tipo | Valor salvo |
|---|---|
| text, long_text, url, email, phone | string |
| number, percent, rating | number |
| money | inteiro em centavos |
| duration | inteiro em minutos |
| date | `"YYYY-MM-DD"` |
| datetime | ISO 8601 em UTC |
| select | id da opção |
| multi_select | array de ids de opção |
| checkbox | boolean |
| relation | array de ids de itens (e sincroniza `links` com `kind='relation'`) |
| contact | array de ids de contatos (fase 3) |
| file | array de ids de anexos |

Criar `buildPropertiesSchema(fields)` que monta dinamicamente um schema Zod para validar `properties` ao salvar. Propriedades com chave que não existe no tipo são preservadas, mas ignoradas na UI (evita perda de dados ao remover campo).

Critério de aceite: testes unitários para cada tipo de campo (válido e inválido).

## 1.3 Onboarding no primeiro acesso

Se `user_settings.onboarding_completed_at` for nulo, redirecionar para `/configuracoes/boas-vindas`:

1. **Espaços:** sugestões marcáveis e editáveis: Pessoal, Trabalho, Estudos, Finanças da casa, Ideias. Campo para adicionar outros (ex.: nomes das empresas). Emoji e cor por espaço.
2. **Tipos básicos** (criados com `is_system = true`, globais):
   - **Nota:** sem campos.
   - **Tarefa:** `status` (select: A fazer, Fazendo, Feito), `prazo` (date), `prioridade` (select: Baixa, Média, Alta).
   - **Documento:** `status` (select: Rascunho, Em revisão, Publicado), `revisar_em` (date).
   - **Referência:** `url`, `autor` (text), `lida` (checkbox).
   - **Ideia:** `potencial` (rating 1–5).
   - **Reunião:** `data` (datetime), `participantes` (text nesta fase; vira `contact` na fase 3).
3. Fuso horário (padrão `America/Sao_Paulo`).
4. Marcar `onboarding_completed_at`.

Tudo em uma server action com transação lógica (se falhar, mostrar erro e permitir tentar de novo sem duplicar: usar `upsert` por `slug`).

## 1.4 Espaços

- Sidebar lista espaços por `position`, com arrastar para reordenar (dnd-kit; recalcular `position` como média entre vizinhos).
- Criar, renomear, ícone, cor, descrição, arquivar, restaurar.
- Excluir só se vazio; senão, oferecer mover itens para outro espaço.
- Página `/espacos/[slug]`: cabeçalho com nome e descrição, abas de visões salvas, botão "Novo" com escolha de tipo, filtros rápidos por tipo e tag.

## 1.5 Tipos de objeto e editor de campos

Página `/configuracoes/tipos` e `/configuracoes/tipos/[slug]`:

- Lista de tipos com ícone, espaço (ou "Todos") e quantidade de itens.
- Editor do tipo: nome, plural, ícone, cor, espaço, visão padrão, template de título.
- **Editor de campos:** adicionar (escolhendo tipo), reordenar por arrastar, editar label, descrição, obrigatório e opções. `key` é gerada do label na criação (slugify sem acentos) e **não muda** depois.
- Remover campo: confirmar ("os valores existentes ficarão ocultos").
- Mudar o tipo de um campo: permitido só entre tipos compatíveis (text ↔ long_text, number ↔ percent/rating, select → multi_select). Nos demais casos, pedir para criar um campo novo.
- **Template de conteúdo:** abrir o editor Tiptap para definir o corpo inicial dos itens do tipo.
- Duplicar tipo.

## 1.6 Itens: criar, ver e editar

Página `/itens/[id]`:

- Título editável (textarea que cresce). Enter vai para o corpo.
- Barra de metadados: espaço, tipo, tags, status, criado/atualizado.
- **Painel de propriedades** gerado a partir de `object_types.fields`, com componente de input por tipo de campo (`src/components/fields/`). Salva ao sair do campo.
- Editor Tiptap (1.7) com **autosave**: debounce de 800 ms, indicador "Salvando…/Salvo", fila local para não perder alterações se a rede cair (reenviar ao reconectar).
- Controle de concorrência simples: enviar `updated_at` conhecido; se o servidor tiver versão mais nova, avisar "Este item foi alterado em outro dispositivo" com opções recarregar ou sobrescrever.
- Ações: mover de espaço, mudar tipo (manter propriedades compatíveis por `key`), duplicar, fixar, arquivar, excluir (lixeira), copiar link, ver versões.
- Subitens: lista de itens com `parent_id` e botão "Adicionar subitem".
- Painel lateral (ou seção no fim, no mobile): **backlinks** e anexos.

Lixeira em `/configuracoes/lixeira`: itens com `deleted_at`, restaurar ou excluir definitivamente (remove anexos do Storage). Job de limpeza automática após 30 dias entra na fase 2.

## 1.7 Editor

Extensões Tiptap:

- StarterKit (títulos H1–H3, listas, citação, código, linha horizontal)
- Placeholder ("Digite / para comandos")
- TaskList e TaskItem
- Link (abrir em nova aba, colar URL sobre texto seleciona como link)
- Table (com cabeçalho)
- CodeBlockLowlight (realce de sintaxe)
- Image com upload para anexos
- Highlight, Underline, Typography
- **Mention para links entre itens**: disparado por `[[`, busca itens via `search_items` e salva o nó `{ id, label }`. Opção "Criar item '<texto>'" quando não existe.
- **Menu de barra `/`**: Título 1/2/3, Lista, Lista numerada, Tarefa, Tabela, Citação, Código, Divisor, Imagem, Anexo, Link para item.
- **Menu flutuante** na seleção: negrito, itálico, sublinhado, destaque, link, código.
- Markdown: atalhos (`#`, `-`, `[]`, `>`, crases) e colar Markdown convertendo em blocos.

Funções puras em `src/features/items/lib/`:

```ts
// Converte o JSON do Tiptap em texto puro (blocos separados por quebra de linha)
export function extractText(doc: JSONContent | null): string;

// Retorna ids únicos dos nós mention (links para itens)
export function extractMentionIds(doc: JSONContent | null): string[];

// Diferença entre links atuais e novos
export function diffLinks(current: string[], next: string[]): { add: string[]; remove: string[] };
```

A server action `updateItemContent` salva `content`, `content_text` e sincroniza `links` (`kind = 'mention'`) de acordo com `diffLinks`.

Critério de aceite: testes de `extractText`, `extractMentionIds` e `diffLinks`; digitar `[[` cria link e o item de destino mostra o backlink.

## 1.8 Tags

- Na captura e no título: `#palavra` vira tag (normalizar para minúsculo; aceitar acentos e hífen).
- Seletor de tags com criação inline e cores.
- `/configuracoes/tags`: renomear, mesclar duas tags, excluir, ver quantidade de itens.
- Filtro por tag em todas as visões e na busca.

## 1.9 Anexos

- Arrastar e soltar no item, colar imagem no editor, botão "Anexar".
- Arquivos até 6 MB: upload padrão. Maiores: **upload resumível (TUS)** suportado pelo Supabase Storage, com barra de progresso.
- Caminho: `{owner_id}/{item_id}/{uuid}-{nome-sanitizado}`.
- Calcular `sha256` no navegador (Web Crypto). Se já existir anexo igual, oferecer reutilizar.
- Visualização: imagens (galeria com zoom), PDF (visualizador embutido), áudio e vídeo (player nativo), outros (ícone + download).
- Download e visualização por **URL assinada** de curta duração (ex.: 1 hora), gerada no servidor.
- Excluir anexo remove o objeto do Storage e a linha.
- Mostrar aviso se o arquivo passar do limite de tamanho do plano do Supabase.

## 1.10 Captura rápida

**Dentro do app:**
- Botão "+" (mobile) e atalho global `Ctrl/Cmd + Shift + Espaço` abrem um diálogo de captura.
- Campo de texto grande: primeira linha vira título; restante vira corpo. `#tag` vira tag.
- Opcional no diálogo: escolher espaço e tipo (senão vai para o inbox), anexar arquivo.
- Enter salva (Shift+Enter quebra linha). Feedback com toast "Capturado" e link.

**Página `/capturar`:** versão tela cheia para mobile (útil como atalho na tela inicial).

**API `POST /api/capture`** (token pessoal com escopo `capture`):

```ts
const captureSchema = z.object({
  title: z.string().max(500).optional(),
  text: z.string().max(100_000).optional(),
  url: z.string().url().optional(),
  tags: z.array(z.string()).max(20).optional(),
  space: z.string().optional(),     // slug do espaço
  type: z.string().optional(),      // slug do tipo
}).refine(d => d.title || d.text || d.url, 'Envie ao menos title, text ou url');
```

- Header: `Authorization: Bearer <token>`.
- Validar: hash do token existe, não revogado, não expirado, contém o escopo. Atualizar `last_used_at`.
- Inserir com cliente admin **preenchendo `owner_id`** do token. `source = 'api'`.
- Se vier `url` sem título, buscar o `<title>` da página no servidor (timeout 5 s, limite de tamanho, bloquear IPs privados para evitar SSRF).
- Resposta: `{ id, url: APP_URL + '/itens/' + id }`.
- Limite simples de taxa: 60 requisições por minuto por token.

## 1.11 Tokens de API

Página `/configuracoes/tokens`:

- Criar token: nome, escopos (`capture`; outros surgem nas próximas fases: `mcp:read`, `mcp:write`, `finance:read`), validade (30/90/365 dias ou sem validade).
- Gerar com `crypto.randomBytes(32).toString('base64url')`, prefixo `hub_`. Mostrar **uma única vez** com botão copiar.
- Listar com prefixo, escopos, último uso, validade; revogar.

`src/lib/tokens.ts`: `generateToken()`, `hashToken()`, `verifyApiToken(request, scope)`.

## 1.12 Bookmarklet, atalhos e PWA

**Bookmarklet** (página `/configuracoes/captura` mostra o código já com o token do usuário selecionado):
- Abre uma janela pequena `APP_URL/capturar?title=...&url=...&text=<seleção>` (usa a sessão do navegador, então não precisa embutir token). Preferir esta abordagem ao envio direto com token.

**Atalho do iOS (Shortcuts):** documentar passo a passo na mesma página: ação "Obter conteúdo da planilha de compartilhamento" → "Obter conteúdo de URL" com método POST para `/api/capture`, header Authorization e corpo JSON.

**PWA:**
- `app/manifest.ts` com nome, ícones (192, 512, maskable), `display: standalone`, cores do tema, `start_url: /inbox`.
- `share_target` com método **GET** apontando para `/capturar` com parâmetros `title`, `text`, `url` (Android). O iOS não suporta share target em PWA; usar o atalho acima.
- Service worker mínimo (ex.: Serwist) com cache do shell e página offline "Sem conexão". Não cachear respostas de dados autenticados.

## 1.13 Inbox

Página `/inbox` com itens `status = 'inbox'`, mais recentes primeiro:

- Cada linha: título, prévia do texto, tags, origem (ícone), data.
- **Modo processamento:** abre um item por vez com o conteúdo à esquerda e ações à direita.
- Atalhos: `E` escolher espaço, `T` tipo, `G` tags, `A` arquivar, `D` excluir, `Enter` abrir, `J/K` próximo/anterior, `X` selecionar.
- Ao definir espaço, o item muda para `status = 'active'`.
- Ações em lote: mover, taguear, arquivar, excluir.
- Contador de inbox na sidebar.
- Estado vazio: "Inbox zerado".

## 1.14 Busca

- Página `/buscar` e busca na paleta de comandos (1.16).
- Chama `search_items` com debounce de 250 ms.
- Filtros: espaço, tipo, tag, status, período de atualização.
- Mostra título, trecho com `<mark>` (renderizar com sanitização, permitindo só `mark`), espaço e tipo.
- Busca por tag com `#tag` na caixa de texto.
- Resultados recentes e itens fixados quando a busca está vazia.

## 1.15 Visões

Componente `ItemsView` recebe `{ spaceId?, typeId?, view }` e renderiza:

**Lista:** título, ícone do tipo, tags, até 3 propriedades escolhidas, data.

**Tabela** (TanStack Table):
- Colunas: título + campos do tipo (quando a visão tem um tipo) ou colunas comuns (tipo, espaço, tags, atualizado).
- Ordenar clicando no cabeçalho; mostrar/ocultar colunas; redimensionar.
- Edição inline das propriedades.
- Filtros por campo com operadores por tipo (`contém`, `=`, `≠`, `>`, `<`, `entre`, `vazio`, `não vazio`, `é qualquer um de`).
- Filtros e ordenação aplicados **no servidor** (query builder que traduz o `config` para consultas em `properties`), com paginação.

**Kanban** (dnd-kit):
- Agrupar por um campo `select` do tipo.
- Arrastar entre colunas atualiza a propriedade; dentro da coluna atualiza `position`.
- Card mostra título e campos com `showInCard`.
- Coluna "Sem valor".
- Adicionar card direto na coluna.

`views.config` (validado com Zod):

```ts
{
  filters: Array<{ field: string; op: string; value?: unknown }>,
  sort: Array<{ field: string; dir: 'asc' | 'desc' }>,
  groupBy?: string,           // kanban
  visibleFields?: string[],
  pageSize?: number
}
```

Salvar, renomear, duplicar e excluir visões; marcar como padrão do espaço/tipo.

## 1.16 Paleta de comandos e atalhos

`Ctrl/Cmd + K` (shadcn `Command`):
- Buscar itens (resultados de `search_items`).
- Ir para: Inbox, espaços, configurações.
- Ações: nova captura, novo item de cada tipo, alternar tema.
- Itens recentes.

Página `/configuracoes/atalhos` lista todos os atalhos.

## 1.17 Histórico de versões

No item, "Versões":
- Lista de versões (data, motivo, rótulo).
- "Salvar versão agora" com rótulo opcional (`reason = 'manual'`).
- Visualizar uma versão em modo leitura.
- **Comparar** com a atual: diff do texto (`extractText` dos dois lados) com a lib `diff`, destacando inclusões e remoções; e diff das propriedades.
- **Restaurar:** cria uma versão do estado atual (`reason = 'restore'`) e aplica a versão escolhida.

## 1.18 Testes da fase

**Unidade (Vitest):**
- `buildPropertiesSchema` para todos os tipos de campo
- `extractText`, `extractMentionIds`, `diffLinks`
- parser de `#tags` da captura
- `hashToken` e `verifyApiToken` (token revogado, expirado, sem escopo)
- tradutor de `views.config` para consulta

**Banco:**
- Cliente anônimo não lê nenhuma tabela do núcleo nem objetos do bucket.
- `search_items` encontra palavra sem acento quando o texto tem acento ("reuniao" acha "reunião").
- Trigger de versão cria no máximo uma versão automática em 10 minutos.

**E2E (Playwright):**
1. Login → captura rápida com `#tag` → aparece no inbox.
2. Processar: escolher espaço e tipo → sai do inbox.
3. Editar conteúdo com `[[` link → backlink aparece no destino.
4. Buscar pelo texto → encontra o item.
5. Kanban: arrastar card muda status.
6. `POST /api/capture` com token válido cria item; com token revogado retorna 401.

## Definição de pronto da fase

- [ ] Onboarding cria espaços e tipos básicos
- [ ] Tipos e campos configuráveis pela interface
- [ ] Itens com editor, autosave, propriedades, tags, subitens, anexos e links
- [ ] Captura por diálogo, página, API, bookmarklet e compartilhamento no Android
- [ ] Inbox com modo processamento e atalhos
- [ ] Busca com filtros e sem sensibilidade a acentos
- [ ] Visões lista, tabela e kanban salvas
- [ ] Histórico de versões com comparação e restauração
- [ ] PWA instalável
- [ ] Testes passando e `PROGRESSO.md` atualizado
