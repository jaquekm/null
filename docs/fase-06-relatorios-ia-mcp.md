# Fase 6 — Relatórios, busca semântica, "pergunte à sua base" e servidor MCP

**Objetivo:** gerar relatórios (financeiros, vendas, projetos, estudos, reuniões e personalizados) em tela e PDF, com envio agendado; busca por significado; perguntas respondidas com citação das fontes; assistentes de IA na organização; e acesso seguro dos seus dados pelo Claude via MCP.

**Entregável usável:** receber todo dia 1º o relatório financeiro do mês em PDF, perguntar "o que decidimos sobre o preço do plano anual?" e receber a resposta com links para as reuniões, e usar o Claude (Claude Code ou apps compatíveis) consultando suas notas.

**Pré-requisito:** Fase 5 concluída.

---

## 6.1 Migration

`supabase migration new relatorios_ia`

```sql
create extension if not exists vector with schema extensions;

-- =========================================================
-- RELATÓRIOS
-- =========================================================
create table public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in (
    'finance_monthly', 'finance_category', 'bills_forecast', 'splits_statement',
    'sales_pipeline', 'projects_status', 'study_progress', 'meetings_digest',
    'weekly_review', 'custom'
  )),
  params jsonb not null default '{}'::jsonb,   -- espaço, período relativo, filtros, seções
  schedule_rrule text,                         -- null = sob demanda
  timezone text not null default 'America/Sao_Paulo',
  next_run_at timestamptz,
  deliver_to jsonb not null default '{"me": true, "contacts": []}'::jsonb,
  channels text[] not null default array['push']::text[],   -- push, email, whatsapp
  include_ai_summary boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  definition_id uuid references public.report_definitions(id) on delete set null,
  kind text not null,
  title text not null,
  period_start date,
  period_end date,
  data jsonb not null,                         -- snapshot imutável dos dados
  ai_summary text,
  pdf_attachment_id uuid references public.attachments(id) on delete set null,
  share_link_id uuid references public.share_links(id) on delete set null,
  status text not null default 'done' check (status in ('running', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now()
);
create index report_runs_idx on public.report_runs (owner_id, created_at desc);

-- =========================================================
-- EMBEDDINGS
-- IMPORTANTE: a dimensão do vetor depende do modelo escolhido (EMBEDDINGS_DIM).
-- Substituir 1024 pelo valor correto antes de rodar a migration.
-- =========================================================
create table public.item_chunks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  source text not null check (source in ('content', 'attachment', 'transcript', 'properties')),
  source_id uuid,                              -- attachment_id ou transcript_id
  chunk_index int not null,
  content text not null,
  token_estimate int not null,
  metadata jsonb not null default '{}'::jsonb, -- título do item, seção, tempo inicial da transcrição, página
  content_hash text not null,
  embedding extensions.vector(1024),
  embedding_model text,
  created_at timestamptz not null default now(),
  unique (item_id, source, source_id, chunk_index)
);
create index item_chunks_item_idx on public.item_chunks (item_id);
create index item_chunks_embedding_idx on public.item_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.items add column indexed_hash text, add column indexed_at timestamptz;

-- =========================================================
-- CONVERSAS COM A BASE
-- =========================================================
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  scope jsonb not null default '{}'::jsonb,    -- { spaceIds, typeIds, dateFrom, dateTo }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,   -- [{ n, itemId, chunkId, title, excerpt }]
  created_at timestamptz not null default now()
);

-- =========================================================
-- AUDITORIA MCP
-- =========================================================
create table public.mcp_audit (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.api_tokens(id) on delete set null,
  tool text not null,
  arguments jsonb,
  result_summary text,
  status text not null check (status in ('ok', 'denied', 'error')),
  duration_ms int,
  created_at timestamptz not null default now()
);
create index mcp_audit_idx on public.mcp_audit (owner_id, created_at desc);

-- =========================================================
-- BUSCA HÍBRIDA (texto + vetor com Reciprocal Rank Fusion)
-- =========================================================
create or replace function public.hybrid_search(
  q text,
  q_embedding extensions.vector(1024),
  p_space_ids uuid[] default null,
  p_type_ids uuid[] default null,
  p_limit int default 20
)
returns table (chunk_id uuid, item_id uuid, title text, content text, metadata jsonb, score double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with filtered_items as (
    select i.id, i.title from public.items i
    where i.deleted_at is null
      and (p_space_ids is null or i.space_id = any(p_space_ids))
      and (p_type_ids is null or i.type_id = any(p_type_ids))
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding <=> q_embedding) as rnk
    from public.item_chunks c
    join filtered_items f on f.id = c.item_id
    where c.embedding is not null
    order by c.embedding <=> q_embedding
    limit 60
  ),
  keyword as (
    select c.id,
      row_number() over (order by ts_rank(to_tsvector('portuguese', unaccent(c.content)),
        websearch_to_tsquery('portuguese', unaccent(q))) desc) as rnk
    from public.item_chunks c
    join filtered_items f on f.id = c.item_id
    where to_tsvector('portuguese', unaccent(c.content)) @@ websearch_to_tsquery('portuguese', unaccent(q))
    limit 60
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
      coalesce(1.0 / (60 + s.rnk), 0) + coalesce(1.0 / (60 + k.rnk), 0) as score
    from semantic s
    full outer join keyword k on k.id = s.id
  )
  select c.id, c.item_id, f.title, c.content, c.metadata, fused.score
  from fused
  join public.item_chunks c on c.id = fused.id
  join filtered_items f on f.id = c.item_id
  order by fused.score desc
  limit p_limit;
$$;

-- Triggers e RLS
create trigger report_definitions_updated_at before update on public.report_definitions for each row execute function public.set_updated_at();
create trigger ai_conversations_updated_at before update on public.ai_conversations for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['report_definitions','report_runs','item_chunks','ai_conversations','ai_messages','mcp_audit']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
```

Se a busca por palavras em `item_chunks` ficar lenta, adicionar coluna `tsvector` gerada por trigger com índice GIN (mesmo padrão de `items`).

## 6.2 Motor de relatórios

**Estrutura** (`src/features/reports/`):

```ts
export interface ReportGenerator<P, D> {
  kind: string;
  label: string;
  paramsSchema: z.ZodType<P>;
  resolvePeriod(params: P, now: Date, tz: string): { start: Date; end: Date };
  collect(ctx: { ownerId: string; params: P; start: Date; end: Date }): Promise<D>;  // consulta dados
  title(params: P, start: Date, end: Date): string;
}
```

- Cada relatório tem **um componente de tela** (`<FinanceMonthlyReport data={...} />`) e **um componente PDF** (`@react-pdf/renderer`) consumindo o mesmo `data`.
- `collect` usa as funções SQL agregadas das fases anteriores; nada de cálculo pesado no cliente.
- Toda execução grava `report_runs` com o **snapshot** em `data`, para que relatórios antigos não mudem quando os dados mudarem.
- Períodos relativos em `params`: `last_month`, `this_month`, `last_7_days`, `last_quarter`, `this_year`, `custom`.
- Gráficos no PDF: componentes SVG próprios simples (barras, linha, rosca) compatíveis com `@react-pdf/renderer`; na tela, `recharts`.

**Relatórios prontos:**

| kind | Conteúdo |
|---|---|
| `finance_monthly` | Por espaço: saldo inicial e final das contas, entradas, saídas efetivas, resultado, comparação com mês anterior e média de 3 meses, gastos por categoria × orçamento, maiores lançamentos, faturas, contas pagas e em aberto, divisões em aberto |
| `finance_category` | Evolução de uma ou mais categorias por 12 meses com lançamentos |
| `bills_forecast` | Contas a pagar e receber dos próximos 30/60/90 dias e saldo projetado |
| `splits_statement` | Extrato de um contato ou grupo: despesas divididas, pagamentos e saldo (compartilhável) |
| `sales_pipeline` | Funil por etapa, valor ponderado, ganhos e perdidos no período com motivos, conversão, tempo médio por etapa, próximas ações |
| `projects_status` | Projetos ativos com progresso, marcos, tarefas atrasadas, concluídas no período |
| `study_progress` | Horas por plano × meta, cursos e livros concluídos, sequência, revisões e taxa de acerto |
| `meetings_digest` | Reuniões do período com resumo, decisões e ações em aberto, por contato ou espaço |
| `weekly_review` | Consolidação da semana: itens criados, tarefas concluídas, reuniões, gastos, estudo |
| `custom` | Ver 6.3 |

**Resumo com IA opcional** (`include_ai_summary`): enviar o `data` agregado (nunca lançamentos individuais com nomes, a menos que o módulo de dados financeiros para IA esteja ativo) e pedir 3–5 frases com destaques e alertas. Exibir marcado como "Resumo gerado por IA".

## 6.3 Relatórios personalizados

Construtor em `/relatorios/novo` (sem SQL livre):
1. **Fonte:** itens de um tipo (com filtros de visão) ou lançamentos financeiros (com filtros).
2. **Agrupar por:** campo select/multi_select/contact/relation, tag, espaço, categoria, período (dia, semana, mês).
3. **Métricas:** contagem, soma/média/mín/máx de campos `number`/`money`/`duration`/`percent`.
4. **Visualização:** tabela, barras, linha, rosca, número único.
5. **Seções:** um relatório pode ter várias seções (cada uma com fonte, agrupamento e visual).
6. Pré-visualização em tempo real.

A execução traduz a configuração em consultas parametrizadas (reaproveitando o tradutor de filtros da fase 1), com limite de linhas.

## 6.4 Execução, agendamento e entrega

- Página `/relatorios`: lista de definições (prontas e personalizadas), botão "Gerar agora", histórico de execuções com data, período e ações.
- Tela do relatório: versão web, botões **Baixar PDF**, **Compartilhar link** (share link com `resource_type='report'`, validade padrão 30 dias), **Enviar**.
- **Job `generate_report`** `{ definitionId | kind+params }`: coleta → snapshot → PDF (salvo como anexo em item de sistema "Relatórios" ou avulso) → resumo IA (se ativo) → entrega.
- **Agendamento:** job periódico `schedule_reports` (a cada 15 min) verifica `next_run_at`, enfileira e calcula a próxima com `rrule`. Presets: todo dia 1º às 8h (mês anterior), toda segunda às 7h (semana anterior), personalizado.
- **Entrega:**
  - Push para mim: "Relatório de agosto pronto" com link.
  - E-mail: corpo com destaques + PDF anexado ou link.
  - WhatsApp para contatos (ex.: extrato de divisão ou relatório para cliente): mensagem com link compartilhado, respeitando opt-in e regras da fase 3.
- Página pública de relatório `/p/[token]` renderiza **somente o snapshot** do `report_runs`.

## 6.5 Provedor de embeddings e indexação

`src/lib/embeddings/types.ts`:

```ts
export interface EmbeddingsProvider {
  model: string;
  dimensions: number;
  embedDocuments(texts: string[]): Promise<number[][]>;   // lote
  embedQuery(text: string): Promise<number[]>;
}
```

**Escolha [HUMANO + pesquisa]:** provedor com bom desempenho em português, custo baixo por token e dimensão compatível com `pgvector`/HNSW (até 2000 dimensões no tipo `vector`). A Anthropic não oferece modelo de embeddings próprio; a documentação dela indica parceiros. Registrar a escolha, o modelo e a dimensão em `docs/decisoes.md` e ajustar a migration.

**Divisão em trechos** (`features/ai/lib/chunking.ts`):
- Conteúdo de itens: dividir por títulos e parágrafos, alvo ~500 tokens (estimativa: caracteres ÷ 4), sobreposição de ~60 tokens; prefixar cada trecho com `Título do item › Seção`.
- Transcrições: agrupar segmentos em janelas de ~2–3 minutos, com locutores e `metadata.start`.
- Anexos: por página quando houver `page_count`; `metadata.page`.
- Propriedades: um trecho com "Campo: valor" legível (resolvendo labels de select e nomes de contatos).
- `content_hash` = sha256 do texto do trecho.

**Job `index_item`** `{ itemId }` com `dedupeKey = 'index:' + itemId` e `runAfter` de 2 min após a última edição (debounce):
1. Pular se `spaces.ai_enabled = false`, módulo de IA desligado ou item excluído (e apagar trechos existentes).
2. Calcular hash geral do item; se igual a `items.indexed_hash`, encerrar.
3. Gerar trechos; reaproveitar embeddings de trechos com mesmo `content_hash`; enviar só os novos em lote.
4. Substituir trechos do item em transação; atualizar `indexed_hash`, `indexed_at`; registrar `usage_events`.

Disparos: server actions de item, fim de transcrição, fim de extração de anexo.

**Reindexação completa** em `/configuracoes/ia`: botão "Reindexar tudo" (enfileira em lotes, mostra progresso e custo estimado antes de confirmar). Necessária ao trocar de modelo.

**Contrato de privacidade (exibir na página de IA):**
- Quais espaços são indexados (lista com toggles de `ai_enabled`).
- Finanças e contatos não são indexados por padrão (toggle separado).
- Custo do mês.

## 6.6 Busca semântica

- Na página `/buscar`, alternância **"Por palavras" / "Por significado"** (padrão: híbrida quando IA ativa).
- Busca híbrida: `embedQuery(q)` → `hybrid_search` → agrupar trechos por item (melhor score) → exibir item com o trecho mais relevante e, em transcrições, botão "Ouvir a partir de 12:30".
- Paleta de comandos continua usando `search_items` (rápida, sem custo).
- **Itens relacionados** no painel do item: média dos embeddings dos trechos do item (ou do primeiro trecho) → vizinhos mais próximos excluindo itens já ligados → "Talvez relacionado" com botão "Criar link".

## 6.7 Pergunte à sua base

Página `/perguntar` (e painel lateral acessível de qualquer item com escopo "este item e relacionados"):

**Fluxo por pergunta:**
1. Escopo escolhido: todos os espaços permitidos, espaços específicos, tipos, período.
2. **Reformulação** (opcional, chamada curta ao Claude): transformar a pergunta + histórico da conversa em uma consulta de busca independente.
3. Recuperar 20 trechos com `hybrid_search`; limitar a um orçamento de tokens de contexto (ex.: ~12 mil tokens), priorizando score e diversidade de itens (máx. 4 trechos por item).
4. Montar contexto numerado:
   ```
   [1] Item: "Reunião com Acme — 12/08/2026" (Reunião, espaço Empresa X) — trecho 00:14:20
   <conteúdo>
   [2] Item: ...
   ```
5. System prompt, em essência:
   - Responda em português do Brasil usando **somente** as fontes fornecidas.
   - Cite as fontes com `[n]` logo após cada afirmação.
   - Se as fontes não forem suficientes, diga claramente o que não foi encontrado; não complete com conhecimento geral sem avisar.
   - Datas: considerar a data atual informada no contexto.
   - Quando houver fontes conflitantes, mostre as duas com as datas.
6. **Streaming** da resposta para a interface (Route Handler com `ReadableStream`).
7. Pós-processamento: mapear `[n]` para links clicáveis (abre o item no trecho/tempo/página); salvar `ai_messages` com `citations`.

**Interface:**
- Conversas salvas na lateral; renomear, excluir.
- Cada citação mostra prévia ao passar o mouse.
- Ações sobre a resposta: copiar, **"Salvar como nota"** (cria item com a resposta e links para as fontes), **"Criar tarefa"**.
- Perguntas sugeridas conforme o escopo ("O que ficou pendente com o cliente X?", "Quanto gastei com delivery nos últimos 3 meses?" — esta última usa ferramenta, ver abaixo).

**Perguntas sobre números (ferramentas):** para finanças, vendas e estudos, dar ao Claude **ferramentas** (tool use) que chamam funções do servidor em vez de depender de trechos de texto:
- `finance_summary(from, to, spaceId?, categoryName?)`
- `list_transactions(from, to, query?, categoryName?, limit)`
- `sales_summary(from, to)`
- `study_summary(from, to)`
- `list_items(type, filters, limit)`
- `list_events(from, to)`

Só expor ferramentas de finanças se o toggle de dados financeiros para IA estiver ativo. Limitar a 5 rodadas de ferramentas por pergunta. Resposta cita a ferramenta como fonte ("Fonte: lançamentos de 01/06 a 31/08").

## 6.8 Assistentes de IA na organização

Todos opcionais, com resultado sempre **revisável antes de aplicar**:

| Assistente | Onde | O que faz |
|---|---|---|
| Organizar inbox | `/inbox` | Para cada item: sugere espaço, tipo, tags e título (JSON); aplicar individual ou em lote |
| Sugerir conexões | Item | Itens relacionados (6.6) + explicação curta do porquê |
| Resumir | Item e anexos | Resumo em bullets inserido no topo como bloco recolhível |
| Extrair tarefas | Item | Lista de tarefas com prazo detectado → criar itens Tarefa |
| Preencher propriedades | Item | Extrai valores dos campos do tipo a partir do conteúdo (ex.: valor e prazo de uma proposta) |
| Melhorar texto | Seleção no editor | Revisar, encurtar, deixar formal, traduzir; mostra diff antes de aplicar |
| Flashcards | Item | Já feito na fase 5 |
| Categorizar lançamentos | Finanças | Já previsto na fase 4 |
| Resumo semanal | Revisão semanal | Destaques da semana a partir de itens, reuniões e tarefas |

Cada assistente: prompt em `src/features/ai/prompts/<nome>.ts`, schema Zod de saída, registro em `usage_events`, verificação de toggles e orçamento, criação de versão `reason='ai'` antes de alterar conteúdo.

## 6.9 Servidor MCP

**Objetivo:** permitir que clientes compatíveis com MCP (como o Claude Code e apps do Claude) consultem e, com permissão, criem conteúdo no Hub.

**Implementação:**
- Rota `src/app/api/mcp/route.ts` usando o **SDK oficial de MCP para TypeScript** (`@modelcontextprotocol/sdk`) com transporte **Streamable HTTP**, sem estado (stateless). Seguir o exemplo atual da documentação do SDK para Next.js/Route Handlers.
- **Autenticação:** `Authorization: Bearer <token>` de `api_tokens` com escopos:
  - `mcp:read` — ferramentas de leitura
  - `mcp:write` — criação e edição
  - `finance:read` — ferramentas financeiras
- Tokens MCP com validade obrigatória (máx. 90 dias) e aviso de expiração por push.
- Toda chamada gravada em `mcp_audit` (ferramenta, argumentos resumidos, status, duração). Página `/configuracoes/mcp` com o log, tokens e instruções.
- Limite de taxa: 120 chamadas por minuto por token.
- Respeitar `ai_enabled` dos espaços: itens de espaços desativados não aparecem.

**Ferramentas:**

| Ferramenta | Escopo | Entrada | Saída |
|---|---|---|---|
| `search` | mcp:read | `query`, `spaces?`, `types?`, `limit?` | Itens com trecho, id, url |
| `get_item` | mcp:read | `id` | Título, tipo, espaço, propriedades legíveis, conteúdo em Markdown, backlinks, anexos (nomes), resumo de transcrição |
| `list_items` | mcp:read | `type`, `space?`, `filters?`, `sort?`, `limit?` | Lista resumida |
| `list_spaces_and_types` | mcp:read | — | Espaços, tipos e campos (para o modelo saber o que existe) |
| `ask_knowledge_base` | mcp:read | `question`, `scope?` | Trechos relevantes numerados (sem chamar o Claude do servidor, para evitar custo duplo) |
| `list_events` | mcp:read | `from`, `to` | Eventos da agenda |
| `list_tasks` | mcp:read | `due_before?`, `status?`, `project?` | Tarefas |
| `get_contact` | mcp:read | `name` ou `id` | Dados básicos, itens ligados recentes (sem telefone/e-mail a menos que o token tenha `contacts:read`) |
| `finance_summary` | finance:read | `from`, `to`, `space?` | Totais e categorias |
| `list_transactions` | finance:read | `from`, `to`, `query?`, `limit?` | Lançamentos |
| `create_item` | mcp:write | `title`, `content_markdown?`, `type?`, `space?`, `tags?`, `properties?` | Id e url (vai para o inbox se não houver espaço) |
| `append_to_item` | mcp:write | `id`, `content_markdown` | Ok (cria versão antes) |
| `update_properties` | mcp:write | `id`, `properties` | Ok (valida com schema do tipo) |
| `create_reminder_for_me` | mcp:write | `title`, `when`, `message?` | Id (somente para o dono; lembretes para terceiros não são expostos via MCP) |

- Conversão Tiptap ↔ Markdown em `features/items/lib/markdown.ts` (com testes de ida e volta nos blocos suportados).
- Descrições das ferramentas claras, em inglês ou português, explicando formatos de data (ISO 8601) e limites.
- **Ações sensíveis não expostas:** excluir itens, enviar mensagens a terceiros, alterar finanças, gerenciar tokens.

**Conectar clientes (documentar em `/configuracoes/mcp`):**
- Claude Code: comando `claude mcp add` com transporte HTTP, URL `https://app.seudominio.com.br/api/mcp` e header `Authorization`. Conferir a sintaxe atual na documentação do Claude Code.
- Outros clientes (apps do Claude, conectores personalizados): verificar na documentação atual quais formas de autenticação são aceitas. Se exigirem OAuth, registrar como melhoria futura ("6.9b: OAuth 2.1 para MCP") em vez de enfraquecer a autenticação.

## 6.10 Testes da fase

**Unidade:**
- Resolução de períodos relativos com fuso.
- `collect` de cada relatório com dados de fixture (valores esperados calculados à mão, especialmente finanças).
- Tradução do construtor de relatórios personalizados.
- Chunking (tamanho, sobreposição, prefixos, transcrições com tempo).
- Hash e reaproveitamento de embeddings.
- Montagem do contexto numerado e mapeamento de citações `[n]`.
- Conversão Tiptap ↔ Markdown.
- Verificação de escopos MCP.

**Integração (provedores mockados):**
- `index_item` não reenvia trechos inalterados; espaço com IA desligada apaga trechos.
- `hybrid_search` retorna item correto para consulta por sinônimo (embedding mock determinístico) e por palavra exata.
- `generate_report` agendado cria execução, PDF e entrega; próxima execução calculada.
- MCP: token sem `finance:read` recebe erro em `finance_summary`; chamadas registradas em `mcp_audit`; token expirado → 401.

**E2E:**
- Gerar relatório financeiro do mês → baixar PDF → compartilhar → abrir link anônimo.
- Perguntar à base (Claude mockado) → resposta com citação clicável abre o item.

## Definição de pronto da fase

- [ ] Relatórios prontos e personalizados, em tela e PDF, com snapshot
- [ ] Agendamento e entrega por push, e-mail e WhatsApp
- [ ] Indexação incremental com embeddings e controle por espaço
- [ ] Busca híbrida e itens relacionados
- [ ] "Pergunte à sua base" com streaming, citações e ferramentas numéricas
- [ ] Assistentes de organização revisáveis
- [ ] Servidor MCP com escopos, auditoria e documentação de conexão
- [ ] Testes passando e `PROGRESSO.md` atualizado
