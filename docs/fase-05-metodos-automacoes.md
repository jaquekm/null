# Fase 5 — Métodos, automações, vendas, estudos, projetos, listas e canvas

**Objetivo:** transformar o núcleo configurável em ferramentas completas para vendas (CRM), estudos (com repetição espaçada), projetos e planejamentos, listas, registro de mudanças e decisões, usando **pacotes de método** instaláveis, automações e novas visões (calendário, linha do tempo, galeria e canvas).

**Entregável usável:** acompanhar oportunidades de venda em kanban com follow-ups automáticos, estudar com flashcards gerados das próprias notas, planejar projetos em linha do tempo e mapear ideias em canvas.

**Pré-requisito:** Fase 4 concluída.

**Princípio desta fase:** o máximo possível deve ser **dados** (tipos, campos, visões, automações). Código novo só para o que tem lógica própria: motor de automações, repetição espaçada, sessões de estudo, visões novas e canvas.

---

## 5.1 Migration

`supabase migration new metodos_automacoes`

```sql
-- =========================================================
-- PACKS INSTALADOS
-- =========================================================
create table public.packs_installed (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pack_key text not null,
  version text not null,
  space_id uuid references public.spaces(id) on delete set null,
  mapping jsonb not null default '{}'::jsonb,   -- chaves do pack → ids criados (tipos, visões, automações)
  installed_at timestamptz not null default now(),
  unique (owner_id, pack_key, space_id)
);

-- =========================================================
-- AUTOMAÇÕES
-- =========================================================
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default true,
  trigger jsonb not null,       -- ver 5.3
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null,       -- array de ações
  space_id uuid references public.spaces(id) on delete cascade,
  type_id uuid references public.object_types(id) on delete cascade,
  pack_key text,
  last_run_at timestamptz,
  run_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  status text not null check (status in ('success', 'skipped', 'failed')),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index automation_runs_idx on public.automation_runs (automation_id, created_at desc);

-- Evita laço infinito: registro de execuções por item em cadeia
create table public.automation_event_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  automation_id uuid not null,
  chain_id uuid not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- CANVAS
-- =========================================================
create table public.canvases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null unique references public.items(id) on delete cascade,  -- canvas é um item (tipo "Canvas")
  viewport jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.canvas_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  canvas_id uuid not null references public.canvases(id) on delete cascade,
  kind text not null check (kind in ('item', 'text', 'group', 'image', 'link', 'contact')),
  item_id uuid references public.items(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  attachment_id uuid references public.attachments(id) on delete set null,
  data jsonb not null default '{}'::jsonb,     -- texto, url, rótulo do grupo
  x double precision not null,
  y double precision not null,
  width double precision,
  height double precision,
  parent_node_id uuid references public.canvas_nodes(id) on delete set null,
  style jsonb not null default '{}'::jsonb,
  z_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index canvas_nodes_canvas_idx on public.canvas_nodes (canvas_id);
create index canvas_nodes_item_idx on public.canvas_nodes (item_id);

create table public.canvas_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  canvas_id uuid not null references public.canvases(id) on delete cascade,
  source_node_id uuid not null references public.canvas_nodes(id) on delete cascade,
  target_node_id uuid not null references public.canvas_nodes(id) on delete cascade,
  label text,
  style jsonb not null default '{}'::jsonb,
  creates_link boolean not null default false,  -- se true, espelha em links (kind='canvas')
  created_at timestamptz not null default now()
);

-- =========================================================
-- ESTUDOS: REPETIÇÃO ESPAÇADA E SESSÕES
-- =========================================================
create table public.review_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null unique references public.items(id) on delete cascade,   -- item tipo Flashcard
  deck_item_id uuid references public.items(id) on delete set null,             -- baralho/curso/plano
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'relearning')),
  due_at timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days double precision not null default 0,
  scheduled_days double precision not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  last_review_at timestamptz,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_cards_due_idx on public.review_cards (owner_id, due_at) where suspended = false;

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.review_cards(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),   -- 1 errei, 2 difícil, 3 bom, 4 fácil
  state_before text not null,
  due_before timestamptz,
  stability_after double precision,
  difficulty_after double precision,
  duration_ms int,
  reviewed_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,    -- curso, livro ou plano
  kind text not null default 'study' check (kind in ('study', 'review', 'reading', 'practice', 'class')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes int,
  notes text,
  created_at timestamptz not null default now()
);
create index study_sessions_idx on public.study_sessions (owner_id, started_at desc);

-- Triggers e RLS
create trigger automations_updated_at before update on public.automations for each row execute function public.set_updated_at();
create trigger canvases_updated_at before update on public.canvases for each row execute function public.set_updated_at();
create trigger canvas_nodes_updated_at before update on public.canvas_nodes for each row execute function public.set_updated_at();
create trigger review_cards_updated_at before update on public.review_cards for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['packs_installed','automations','automation_runs','automation_event_log','canvases',
    'canvas_nodes','canvas_edges','review_cards','review_logs','study_sessions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
```

## 5.2 Formato e instalador de packs

Arquivos em `packs/<chave>.json`, validados por `packSchema` (Zod):

```jsonc
{
  "key": "crm",
  "version": "1.0.0",
  "name": "Vendas (CRM)",
  "description": "Oportunidades, propostas e atividades com funil e follow-ups",
  "icon": "💼",
  "requires": ["contacts", "finance"],            // módulos necessários
  "types": [
    {
      "ref": "opportunity",                       // referência interna do pack
      "name": "Oportunidade", "plural": "Oportunidades", "slug": "oportunidade", "icon": "🎯",
      "fields": [ /* fieldDefinition[] */ ],
      "template": { /* Tiptap JSON */ },
      "titleTemplate": null
    }
  ],
  "views": [
    { "ref": "pipeline", "typeRef": "opportunity", "name": "Funil", "kind": "kanban",
      "config": { "groupBy": "stage" }, "isDefault": true }
  ],
  "automations": [ /* automation com typeRef em vez de type_id */ ],
  "reminderRules": [ /* opcional */ ],
  "sampleItems": [ /* opcional, instalados só se o usuário marcar "com exemplos" */ ]
}
```

**Instalador** (`features/packs/lib/install.ts`), idempotente:
1. Validar pack e dependências de módulos.
2. Usuário escolhe o espaço (ou "todos") e pode **renomear** tipos, campos e opções na tela de instalação.
3. Criar tipos com `pack_key`; resolver `relationTypeId` entre tipos do mesmo pack pelas `ref`.
4. Criar visões, automações e regras resolvendo referências.
5. Salvar mapeamento em `packs_installed.mapping`.
6. Reinstalar/atualizar versão: adicionar o que falta sem sobrescrever personalizações (campos novos entram; campos renomeados pelo usuário são mantidos).
7. **Desinstalar:** remove automações e visões; tipos só se não tiverem itens (senão, oferece arquivar).

**Exportar como pack:** em `/configuracoes/tipos`, selecionar tipos, visões e automações e baixar um JSON no formato acima (para backup ou reutilização).

Página `/configuracoes/metodos`: galeria dos packs com descrição, prévia do que será criado, instalar, atualizar, desinstalar.

## 5.3 Motor de automações

**Gatilhos (`trigger`):**

| type | Configuração | Quando dispara |
|---|---|---|
| `item_created` | `typeId?`, `spaceId?` | Item criado |
| `property_changed` | `field`, `to?`, `from?` | Propriedade mudou (ex.: `stage` → `won`) |
| `status_changed` | `to` | `items.status` mudou |
| `date_reached` | `field`, `offsetMinutes` | Data do campo + deslocamento chegou |
| `no_activity` | `days`, `typeId` | Item sem atualização (nem itens ligados) há N dias |
| `schedule` | `rrule`, `timezone` | Horário recorrente (ex.: toda segunda 8h) |
| `tag_added` | `tag` | Tag adicionada |

**Condições (`conditions`):** mesma estrutura de filtros das visões (`{ field, op, value }`), avaliadas no item.

**Ações (`actions`):**

| type | Parâmetros |
|---|---|
| `set_property` | `field`, `value` (aceita `{{today}}`, `{{today+7d}}`) |
| `add_tag` / `remove_tag` | `tag` |
| `move_to_space` | `spaceId` |
| `create_item` | `typeId`, `title` (template), `properties`, `linkToTrigger: boolean`, `parent: boolean` |
| `create_checklist` | `items: string[]` (insere lista de tarefas no conteúdo) |
| `create_reminder` | `recipient: 'me' \| 'contact_field'`, `field?`, `offsetMinutes`, `message` |
| `notify_me` | `title`, `body` (push) |
| `create_bill` | `direction`, `amountField`, `dueInDays`, `contactField`, `description` |
| `create_review_cards` | a partir de itens Flashcard ligados |
| `call_webhook` | `url` (lista permitida), assinado com HMAC (para N8N) |

**Execução:**
- Eventos de item (`created`, `property_changed`, `status_changed`, `tag_added`) são detectados **na camada de server actions** (função `emitItemEvent(before, after)`), que enfileira job `run_automations` `{ event, itemId, before, after, chainId }`.
- Gatilhos temporais (`date_reached`, `no_activity`, `schedule`) são avaliados por job periódico `evaluate_time_automations` a cada 5 minutos, com registro de última execução por item para não repetir.
- **Proteção contra laços:** ações executadas por automação emitem eventos com o mesmo `chainId`; se a mesma automação já rodou no mesmo item nessa cadeia, pular; profundidade máxima 5.
- Cada execução grava `automation_runs`.
- Automações de itens criados por automação têm `source='automation'`.

**Interface** `/configuracoes/automacoes`:
- Lista com ativar/desativar, última execução e contagem.
- Editor em linguagem natural por blocos: **Quando** [gatilho] **Se** [condições] **Então** [ações].
- "Testar com item…": simula e mostra o que aconteceria sem aplicar.
- Histórico de execuções com detalhes de falha.

## 5.4 Novas visões

**Calendário:** itens posicionados por um campo `date`/`datetime` escolhido na visão; arrastar muda a data; mês e semana. Reutilizar componentes da agenda.

**Linha do tempo (Gantt simples):** barras entre campo de início e campo de fim; agrupar por um campo (ex.: projeto, responsável); arrastar e redimensionar altera datas; linha do "hoje"; zoom semana/mês/trimestre. Dependências opcionais por campo `relation` "depende de" (setas simples).

**Galeria:** cards com capa (`cover_path` ou primeira imagem do conteúdo), título e campos escolhidos. Útil para livros, cursos e referências.

Adicionar `calendar`, `timeline` e `gallery` ao editor de visões com as configurações específicas (campo de data, campos de início e fim, campo de capa).

## 5.5 Canvas

Biblioteca: **React Flow (@xyflow/react)**, pois cada nó pode ser um item real do banco.

- Tipo de sistema **Canvas** (`is_system`): criar um item deste tipo abre `/itens/[id]` em modo canvas (tela cheia).
- **Nós:**
  - `item`: card com ícone do tipo, título, 2 propriedades e prévia; clique duplo abre o item em painel lateral sem sair do canvas.
  - `text`: nota adesiva editável (Markdown simples).
  - `group`: moldura com rótulo que agrupa nós.
  - `image`: anexo de imagem.
  - `link`: URL com título.
  - `contact`: cartão de contato.
- **Adicionar:** arrastar item da busca lateral para o canvas; clique duplo no vazio cria texto; colar URL cria nó de link; colar imagem cria anexo.
- **Arestas:** conectar nós; rótulo editável; opção "criar link entre itens" (`creates_link`) espelha em `links` com `kind='canvas'`.
- Seleção múltipla, alinhar, distribuir, agrupar, mudar cor, travar.
- Minimapa, zoom, "centralizar tudo", modo apresentação (percorre grupos em ordem).
- **Persistência:** salvar posição com debounce (500 ms) em lote; viewport salvo ao sair.
- Um mesmo item pode estar em vários canvases; no item, seção "Aparece nos canvases".
- Templates de canvas via packs: brainstorm, mapa de arquitetura, metas do ano, mapa de estudo.
- Exportar canvas como PNG/SVG (API de exportação do React Flow com `html-to-image`).

## 5.6 Pack: Vendas (CRM)

**Tipos:**

- **Oportunidade** 🎯
  - `contact` (contact, obrigatório), `company` (text), `value` (money), `stage` (select: Lead, Qualificado, Proposta enviada, Negociação, Ganho, Perdido), `probability` (percent), `expected_close` (date), `source` (select: Indicação, Site, Instagram, WhatsApp, Evento, Outro), `lost_reason` (select: Preço, Timing, Concorrente, Sem resposta, Outro), `next_step` (text), `next_step_date` (date), `products` (multi_select editável)
- **Proposta** 📄
  - `opportunity` (relation → Oportunidade), `value` (money), `valid_until` (date), `status` (select: Rascunho, Enviada, Aceita, Recusada), `sent_at` (date), `file` (file)
- **Atividade** 📞
  - `opportunity` (relation), `contact` (contact), `activity_type` (select: Ligação, Reunião, E-mail, WhatsApp, Visita), `date` (datetime), `outcome` (long_text)

**Visões:** Funil (kanban por `stage` com soma de `value` por coluna), Previsão (tabela agrupada por mês de `expected_close` com valor × probabilidade), Minhas próximas ações (lista ordenada por `next_step_date`), Propostas em aberto.

**Automações:**
1. `stage` → `Proposta enviada`: criar lembrete para mim em 3 dias "Follow-up da proposta: {{titulo}}".
2. `no_activity` 7 dias em oportunidades abertas: notificar "Oportunidade parada: {{titulo}}".
3. `stage` → `Ganho`: criar conta a receber (`create_bill` com `value` e contato), criar item Projeto de onboarding com checklist, adicionar tag `cliente` ao contato.
4. `stage` → `Perdido` sem `lost_reason`: notificar pedindo o motivo.
5. `next_step_date` alcançada: push com o `next_step`.

**Código específico (pequeno):**
- Soma de valores por coluna no kanban (genérico: agregação de campo `money` no cabeçalho da coluna; útil em qualquer tipo).
- Painel `/vendas` (página gerada a partir do pack): valor em aberto no funil, previsão ponderada do mês, taxa de conversão por etapa (a partir do histórico de versões de `stage`), tempo médio por etapa, ganhos × perdidos por motivo.
- No contato: aba Vendas com oportunidades e atividades.
- Gerar proposta em PDF a partir de template do tipo Proposta (reaproveitando o gerador da fase 6 quando existir; nesta fase, exportar HTML para impressão).

## 5.7 Pack: Estudos

**Tipos:**

- **Plano de estudo** 🧭: `goal` (long_text), `deadline` (date), `weekly_hours_target` (duration), `status` (select: Planejando, Em andamento, Pausado, Concluído)
- **Curso** 🎓: `plan` (relation → Plano), `platform` (text), `url`, `progress` (percent), `status` (select: Quero fazer, Fazendo, Concluído, Abandonado), `started_on`, `finished_on` (date), `certificate` (file)
- **Livro** 📚: `author`, `status` (select: Quero ler, Lendo, Lido, Abandonado), `pages` (number), `current_page` (number), `rating`, `finished_on`
- **Fonte** 🔗: `url`, `source_type` (select: Artigo, Vídeo, Podcast, Paper, Documentação), `author`
- **Nota de estudo** 📝: `about` (relation → Curso/Livro/Fonte, múltiplo), `concepts` (multi_select)
- **Flashcard** 🃏: `front` (long_text), `back` (long_text), `deck` (relation → Plano/Curso/Livro)

**Visões:** Estante (galeria de livros por status), Cursos (kanban por status), Plano (lista de itens ligados com progresso).

**Código específico:**

*Repetição espaçada:* usar a biblioteca **`ts-fsrs`** (algoritmo FSRS).
- Ao criar item Flashcard → criar `review_cards` (`state='new'`).
- Página `/estudos/revisar`:
  - Contadores: novos, aprendendo, para revisar hoje; filtro por baralho.
  - Card mostra `front` → "Mostrar resposta" → `back` → botões **Errei / Difícil / Bom / Fácil** com o próximo intervalo previsto em cada botão.
  - Atalhos: espaço mostra resposta; 1–4 avalia.
  - Grava `review_logs` e atualiza o card com o resultado do FSRS.
  - Limite configurável de novos cards por dia (padrão 20).
  - Suporta Markdown e imagens nos lados do card.
- Suspender card, editar durante a revisão.
- Estatísticas: revisões por dia (heatmap), taxa de acerto, previsão de revisões dos próximos 30 dias.
- **Gerar flashcards com IA** a partir de uma nota, transcrição de aula ou documento: Claude retorna JSON `[{ front, back }]` (perguntas objetivas, uma ideia por card, sem cards triviais); tela de revisão para aprovar, editar ou descartar antes de criar.
- **Importar do Anki:** CSV/TXT exportado (frente;verso) com escolha de baralho.
- Push diário (horário configurável) "Você tem N cards para revisar".

*Sessões de estudo:*
- Cronômetro (Pomodoro opcional 25/5) a partir de qualquer Curso, Livro ou Plano → grava `study_sessions`.
- Registro manual de sessão.
- Painel `/estudos`: horas na semana × meta do plano, sequência de dias estudados, cursos em andamento com progresso, livros lendo com página atual, revisões pendentes.
- Automação do pack: `Curso.progress` = 100 → `status` = Concluído e `finished_on` = hoje.
- Opção "Agendar estudo": cria blocos recorrentes no Google Calendar (fase 3).

## 5.8 Pack: Projetos e planejamentos

**Tipos:**

- **Projeto** 🚀: `status` (select: Ideia, Planejado, Em andamento, Pausado, Concluído, Cancelado), `area` (select editável), `start` (date), `end` (date), `priority`, `goal` (long_text), `budget` (money), `client` (contact)
- **Tarefa** (estender o tipo básico): `project` (relation → Projeto), `estimate` (duration), `depends_on` (relation → Tarefa, múltiplo), `start` (date), `assignee` (contact, para tarefas delegadas)
- **Marco** 🏁: `project` (relation), `date` (date), `done` (checkbox)
- **Meta** 🎯: `period` (select: Trimestre, Ano), `year` (number), `key_results` (long_text), `progress` (percent), `area`

**Visões:** Portfólio (tabela de projetos com progresso), Quadro (kanban de tarefas por status), Cronograma (linha do tempo de tarefas e marcos por projeto), Metas do ano (galeria).

**Código específico:**
- **Progresso do projeto** calculado: tarefas concluídas ÷ total (ou por estimativa), exibido como propriedade calculada somente leitura. Implementar suporte genérico a **campos calculados** simples no tipo: `rollup` (contar/somar/porcentagem de itens relacionados que atendem condição).
- **Revisão semanal** (`/revisao-semanal`, também gerada pelo pack): passo a passo guiado — 1) zerar inbox, 2) revisar projetos em andamento (atualizar status e próximo passo), 3) tarefas atrasadas (reagendar/concluir/excluir), 4) agenda da próxima semana, 5) contas da semana, 6) notas livres da semana. Salva um item "Revisão semanal AAAA-SS" com o resumo.
- **Nota diária** (opcional): item automático do dia com template (prioridades, agenda do dia gerada, notas), acessível por atalho `Ctrl/Cmd + D`.
- Automações: tarefa concluída em projeto → se todas concluídas, notificar "Projeto X pode ser encerrado"; marco atrasado → notificar.

## 5.9 Pack: Listas

**Tipo Lista** ✅: `list_kind` (select: Compras, Viagem, Mudança de casa, Checklist de processo, Outros), `recurring` (checkbox), `shared_with` (contact).

- Conteúdo é checklist no editor; **modo lista** otimizado para celular (itens grandes, marcar com toque, marcados vão para o fim, adicionar com Enter).
- **Duplicar como nova** (mantém itens, desmarca todos): para listas recorrentes de compras ou checklists de processo.
- **Compartilhar com permissão `check`** (fase 3) para família marcar itens.
- Templates: Compras do mês, Mala de viagem, Mudança de casa (por cômodo e etapa), Checklist de deploy, Onboarding de cliente.

## 5.10 Pack: Mudanças e decisões

Para registrar mudanças em sistemas, processos, casa ou vida pessoal:

- **Registro de mudança** 🔁: `area` (select editável: Sistema, Processo, Casa, Saúde, Financeiro…), `system` (text), `date` (date), `change_type` (select: Nova funcionalidade, Correção, Configuração, Processo, Pessoal), `impact` (select: Baixo, Médio, Alto), `reversible` (checkbox), `rollback_plan` (long_text), `related` (relation)
- **Decisão (ADR)** ⚖️: `status` (select: Proposta, Aceita, Substituída, Rejeitada), `date`, `context` (long_text), `options` (long_text), `decision` (long_text), `consequences` (long_text), `superseded_by` (relation → Decisão)
- **Documento de processo (SOP)** 📘: estende Documento com `owner_area`, `review_every_days` (number), `last_reviewed` (date)

**Visões:** Changelog (linha do tempo por `area`), Decisões (tabela por status).

**Automações:**
- SOP: quando `last_reviewed + review_every_days` alcançar hoje → definir `revisar_em`, notificar "Revisar: {{titulo}}".
- Decisão marcada `Substituída` sem `superseded_by` → notificar.
- Painel "Documentos a revisar" na página do espaço.

## 5.11 Pack: PARA e Zettelkasten (métodos de organização)

- **PARA:** cria espaços ou coleções Projetos, Áreas, Recursos, Arquivo; tipo **Área de responsabilidade** com `review_frequency`; automação "Projeto concluído → mover para Arquivo".
- **Zettelkasten:** tipos **Nota permanente** (`id_zettel` gerado, `sources` relation) e **Nota literária** (`source` relation); visão de notas sem links ("órfãs") para conectar; sugestão de conexões (fase 6).
- **GTD:** contextos como tags (`@casa`, `@computador`, `@rua`), campo `next_action` (checkbox), visão "Próximas ações por contexto", "Aguardando" (tarefas delegadas com `assignee`).

## 5.12 Diário e hábitos (opcional nesta fase)

- **Entrada de diário** 📓: `mood` (rating), `energy` (rating), `gratitude` (long_text), `date` (date). Visão calendário.
- **Hábito** 🔥: `frequency` (rrule simples), `target_per_period` (number). Registro diário por checkbox no dia (tabela `habit_logs` se for implementado; avaliar necessidade antes de criar).

## 5.13 Testes da fase

**Unidade:**
- `packSchema` e resolução de referências do instalador; instalação idempotente; atualização sem sobrescrever renomeações.
- Avaliação de condições e gatilhos das automações; templates de datas (`{{today+7d}}`).
- Proteção contra laço (automação que dispara a si mesma).
- Integração com `ts-fsrs`: estado inicial, avaliações e datas previstas; limite de novos cards.
- Campos calculados `rollup`.
- Algoritmo de conversão por etapa a partir das versões.

**Integração:**
- Instalar CRM → mover oportunidade para "Ganho" → conta a receber e projeto criados; executar de novo não duplica.
- `no_activity` e `date_reached` disparam uma única vez por item.
- Aresta de canvas com `creates_link` cria e remove o link.

**E2E:**
- Instalar pack Estudos → criar nota → gerar flashcards (IA mockada) → revisar 3 cards.
- Criar canvas → arrastar 2 itens → conectar → recarregar e ver posições salvas.
- Linha do tempo: arrastar tarefa altera datas.

## Definição de pronto da fase

- [ ] Instalador de packs com personalização, atualização e exportação
- [ ] Motor de automações com gatilhos de evento e tempo, histórico e teste
- [ ] Visões calendário, linha do tempo e galeria
- [ ] Canvas com itens reais, arestas, grupos e exportação
- [ ] Packs: CRM, Estudos, Projetos, Listas, Mudanças e decisões, PARA/Zettelkasten/GTD
- [ ] Revisão com FSRS, sessões de estudo e flashcards por IA
- [ ] Revisão semanal guiada e nota diária
- [ ] Testes passando e `PROGRESSO.md` atualizado
