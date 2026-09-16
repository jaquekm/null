# Fase 2 — Mídia: fila de jobs, gravação, transcrição, resumo de reuniões e OCR

**Objetivo:** gravar ou enviar áudios e reuniões, transcrever com identificação de locutores, gerar resumo com decisões e ações, e extrair texto de documentos e imagens para que tudo fique pesquisável.

**Entregável usável:** gravar uma reunião pelo celular e, minutos depois, ter a transcrição, o resumo e as tarefas geradas dentro do item.

**Pré-requisito:** Fase 1 concluída.

---

## 2.1 Migration

`supabase migration new midia_jobs`

```sql
-- =========================================================
-- FILA DE JOBS
-- =========================================================
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'canceled')),
  priority int not null default 100,          -- menor = mais prioritário
  attempts int not null default 0,
  max_attempts int not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  finished_at timestamptz,
  last_error text,
  result jsonb,
  dedupe_key text,                            -- evita jobs duplicados ativos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_pending_idx on public.jobs (status, priority, run_after) where status = 'queued';
create unique index jobs_dedupe_idx on public.jobs (dedupe_key) where dedupe_key is not null and status in ('queued', 'running');

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- Reserva de jobs (somente service role)
create or replace function public.claim_jobs(p_limit int default 5)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  -- devolve para a fila jobs travados há mais de 15 minutos
  update public.jobs
     set status = 'queued', locked_at = null
   where status = 'running' and locked_at < now() - interval '15 minutes';

  return query
  update public.jobs j
     set status = 'running', locked_at = now(), attempts = j.attempts + 1
   where j.id in (
     select id from public.jobs
      where status = 'queued' and run_after <= now()
      order by priority, run_after
      limit p_limit
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke all on function public.claim_jobs(int) from public, anon, authenticated;

-- Tarefas periódicas
create table public.job_schedules (
  kind text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  interval_seconds int not null,
  payload jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_enqueued_at timestamptz
);

-- =========================================================
-- TRANSCRIÇÕES
-- =========================================================
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  provider text not null,
  external_id text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  language text default 'pt',
  text text,
  segments jsonb,        -- [{ start: number, end: number, speaker: string, text: string }]
  speaker_names jsonb not null default '{}'::jsonb,   -- { "A": "João", "B": "Eu" }
  summary jsonb,         -- ver 2.7
  duration_seconds numeric,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index transcripts_item_idx on public.transcripts (item_id);

create trigger transcripts_updated_at before update on public.transcripts
  for each row execute function public.set_updated_at();

-- =========================================================
-- EXTRAÇÃO DE TEXTO DOS ANEXOS
-- =========================================================
alter table public.attachments
  add column extracted_text text,
  add column extraction_status text not null default 'none'
    check (extraction_status in ('none', 'queued', 'processing', 'done', 'failed', 'skipped')),
  add column extraction_method text,     -- 'pdf_text', 'docx', 'ai_ocr', 'plain'
  add column page_count int;

-- Recalcula items.extra_text a partir de anexos e transcrições
create or replace function public.refresh_item_extra_text(p_item_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.items i
     set extra_text = left(
       coalesce((select string_agg(a.extracted_text, E'\n\n') from public.attachments a
                  where a.item_id = p_item_id and a.extracted_text is not null), '')
       || E'\n\n' ||
       coalesce((select string_agg(t.text, E'\n\n') from public.transcripts t
                  where t.item_id = p_item_id and t.text is not null), ''),
       500000)
   where i.id = p_item_id;
$$;
revoke all on function public.refresh_item_extra_text(uuid) from public, anon;

-- =========================================================
-- USO E CUSTO DE SERVIÇOS EXTERNOS
-- =========================================================
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,          -- 'anthropic', 'transcription', 'embeddings', 'resend', 'whatsapp'
  feature text not null,           -- 'meeting_summary', 'ocr', 'transcription', ...
  model text,
  units jsonb not null default '{}'::jsonb,   -- { input_tokens, output_tokens } ou { seconds }
  cost_usd numeric(12, 6),
  item_id uuid references public.items(id) on delete set null,
  created_at timestamptz not null default now()
);
create index usage_events_month_idx on public.usage_events (owner_id, created_at);

-- RLS
do $$
declare t text;
begin
  foreach t in array array['jobs','job_schedules','transcripts','usage_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
```

## 2.2 Motor de jobs

**Código:** `src/lib/jobs/`

```ts
// registry.ts
export type JobHandler = (job: Job, ctx: JobContext) => Promise<JobOutcome>;
export type JobOutcome =
  | { status: 'done'; result?: unknown }
  | { status: 'retry'; error: string; delaySeconds?: number }
  | { status: 'failed'; error: string };

export const handlers: Record<string, JobHandler> = {
  transcribe_audio, summarize_transcript, extract_attachment,
  purge_trash, poll_transcription,
  // fases seguintes registram: calendar_sync, dispatch_reminders, generate_reminders,
  // index_item, run_automation, generate_report...
};
```

```ts
// enqueue.ts
export async function enqueueJob(input: {
  ownerId: string; kind: string; payload?: object;
  runAfter?: Date; priority?: number; dedupeKey?: string; maxAttempts?: number;
}): Promise<void>;
// Ignorar erro de violação do índice dedupe (job equivalente já na fila).
// Após inserir job com runAfter <= agora, disparar fetch sem await para /api/jobs/tick
// (acelera o processamento sem depender do cron).
```

**Rota `POST /api/jobs/tick`:**

1. Validar `Authorization: Bearer ${CRON_SECRET}` com comparação em tempo constante.
2. Enfileirar tarefas periódicas vencidas de `job_schedules` (atualizando `last_enqueued_at`).
3. Chamar `claim_jobs(5)` com cliente admin.
4. Executar handlers em sequência, respeitando orçamento de tempo (ex.: parar de pegar novos jobs após 45 s; configurar `maxDuration` da rota conforme o plano da Vercel).
5. Resultado:
   - `done` → `status='done'`, `finished_at`, `result`.
   - `retry` → se `attempts < max_attempts`: `status='queued'`, `run_after = now() + delay` (padrão: `2^attempts` minutos, máx. 60) e `last_error`. Senão → `failed`.
   - `failed` ou exceção não tratada → mesma regra do retry para exceções; `failed` direto quando o handler decidir.
6. Responder `{ processed, ids }`.

**Agendamento com pg_cron (projeto de produção e dev remoto):**

```sql
-- [HUMANO] guardar o segredo no Vault antes:
-- select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- select vault.create_secret('https://app.seudominio.com.br', 'app_url');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'jobs-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/jobs/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Essa parte fica em um arquivo `supabase/manual/cron.sql` (não em migration), porque URL e segredo mudam por ambiente. Em desenvolvimento local, criar o script `pnpm jobs:dev` que chama o tick a cada 10 s.

**Página `/configuracoes/jobs`:** lista com filtros por status e tipo, detalhes (payload, erro, tentativas), botões "Tentar de novo" e "Cancelar". Contador de jobs com falha na sidebar de configurações.

**Job `purge_trash`** (periódico, diário): exclui definitivamente itens com `deleted_at` há mais de 30 dias, removendo anexos do Storage.

Critério de aceite: testes do cálculo de backoff e do fluxo retry/failed; job de teste passa pelo ciclo completo localmente.

## 2.3 Cliente Claude e controle de custos

`src/lib/ai/claude.ts`:

```ts
export async function callClaude(opts: {
  ownerId: string;
  feature: string;
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  itemId?: string;
}): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }>;

export async function callClaudeJson<T>(opts: /* igual */ & { schema: z.ZodType<T> }): Promise<T>;
```

- Modelo vem de `ANTHROPIC_MODEL`.
- `callClaudeJson`: instruir no system a responder **apenas JSON**; remover cercas de código; validar com Zod; em caso de JSON inválido, repetir **uma vez** enviando o erro de validação; se falhar de novo, lançar erro.
- Registrar cada chamada em `usage_events` com tokens e custo estimado (tabela de preços em `src/lib/ai/pricing.ts`, fácil de atualizar).
- **Orçamento:** antes de chamar, somar `cost_usd` do mês. Se passar de `AI_MONTHLY_BUDGET_USD`, retornar erro "Orçamento mensal de IA atingido" (o job fica `failed` com essa mensagem).
- Verificar `user_settings.modules.ai` e `spaces.ai_enabled` do item antes de enviar conteúdo.

Página `/configuracoes/uso`: custo do mês por provedor e por recurso, gráfico diário, orçamento.

## 2.4 Provedor de transcrição

`src/lib/transcription/types.ts`:

```ts
export interface TranscriptionProvider {
  name: string;
  submit(input: {
    audioUrl: string;            // URL assinada do Storage
    language: string;            // 'pt'
    diarization: boolean;
    webhookUrl: string;
  }): Promise<{ externalId: string }>;
  fetchResult(externalId: string): Promise<
    | { status: 'processing' }
    | { status: 'failed'; error: string }
    | { status: 'completed'; text: string; segments: Segment[]; durationSeconds: number }
  >;
  verifyWebhook(req: Request): Promise<{ externalId: string } | null>;
}
```

**Escolha do provedor [HUMANO + pesquisa]:** escolher um serviço que ofereça, na documentação atual:
- português do Brasil com boa precisão;
- **diarização** (separação de locutores);
- envio por **URL** do arquivo e **webhook** ao terminar (evita manter conexão aberta e dividir arquivos);
- aceitar arquivos longos (1–3 h) e formatos `webm`, `m4a`, `mp3`, `mp4`.

Implementar o provedor escolhido em `src/lib/transcription/<provedor>.ts` e selecionar por `TRANSCRIPTION_PROVIDER`. Registrar a decisão em `docs/decisoes.md` com preço por hora na data da escolha.

## 2.5 Gravação e envio de áudio

**Componente `AudioRecorder`** (`src/features/media/components/`):

- `MediaRecorder` com detecção de formato: `audio/webm;codecs=opus` (Chrome/Android) e `audio/mp4` (Safari/iOS).
- Taxa de bits reduzida (ex.: 32–48 kbps) para arquivos pequenos.
- UI: botão gravar/pausar/parar, cronômetro, medidor de nível (AnalyserNode), aviso "Mantenha a tela ligada" (usar **Wake Lock API** quando disponível).
- **Proteção contra perda:** a cada 30 s guardar os pedaços gravados no IndexedDB; se a página fechar, oferecer recuperar a gravação ao voltar.
- Ao parar: upload resumível (TUS) com progresso; após concluir, limpar IndexedDB.

**Pontos de entrada:**
1. Botão "Gravar" na captura rápida → cria item tipo **Nota** com `source='voice'`.
2. Botão "Gravar reunião" em itens do tipo **Reunião** (e no menu "+").
3. Enviar arquivo de áudio/vídeo existente em qualquer item → pergunta "Transcrever?".

Após o upload: criar `attachments` (com `duration_seconds` lido no navegador) e `transcripts` (`status='queued'`), e enfileirar `transcribe_audio` com `dedupeKey = 'transcribe:' + attachmentId`.

## 2.6 Pipeline de transcrição

**Job `transcribe_audio`** `{ transcriptId }`:
1. Carregar transcript e anexo.
2. Gerar URL assinada do Storage válida por 24 h.
3. `provider.submit({ audioUrl, language: 'pt', diarization: true, webhookUrl: APP_URL + '/api/webhooks/transcription' })`.
4. Salvar `external_id`, `status='processing'`.
5. Enfileirar `poll_transcription` com `runAfter` de 30 min, como garantia caso o webhook não chegue.

**Rota `POST /api/webhooks/transcription`:**
1. `provider.verifyWebhook(req)` (segredo ou assinatura). Inválido → 401.
2. **Não confiar no conteúdo do webhook:** buscar o resultado com `provider.fetchResult(externalId)`.
3. Se `completed`: salvar `text`, `segments` normalizados, `duration_seconds`, `status='completed'`; chamar `refresh_item_extra_text`; registrar `usage_events` (segundos); enfileirar `summarize_transcript` se o item for do tipo Reunião ou se o usuário marcou "resumir".
4. Se `failed`: salvar erro e `status='failed'`.
5. Responder 200 rapidamente. Operação idempotente (webhook repetido não duplica nada).

**Job `poll_transcription`:** se ainda `processing`, consultar `fetchResult`; aplicar a mesma lógica; se continuar processando, reagendar (máx. 6 h).

## 2.7 Resumo de reuniões

**Job `summarize_transcript`** `{ transcriptId }`:

Montar o texto com locutores e marcações de tempo:

```
[00:03:12] João: ...
[00:03:40] Eu: ...
```

Aplicando `speaker_names` quando existirem. Se o texto for muito grande para uma chamada, dividir em blocos com sobreposição, resumir cada bloco e depois consolidar.

Schema de saída (`src/features/media/schemas.ts`):

```ts
export const meetingSummarySchema = z.object({
  titulo_sugerido: z.string(),
  resumo: z.string(),                          // 1–3 parágrafos
  topicos: z.array(z.object({
    titulo: z.string(),
    pontos: z.array(z.string()),
    inicio: z.string().optional(),             // "00:12:30"
  })),
  decisoes: z.array(z.string()),
  acoes: z.array(z.object({
    descricao: z.string(),
    responsavel: z.string().nullable(),
    prazo: z.string().nullable(),              // "YYYY-MM-DD" quando explícito
  })),
  perguntas_em_aberto: z.array(z.string()),
  participantes_mencionados: z.array(z.string()),
});
```

System prompt (resumo do que deve conter):
- Você resume reuniões em português do Brasil, com fidelidade ao que foi dito.
- Não invente decisões, prazos ou responsáveis. Use `null` quando não houver.
- Datas relativas ("sexta que vem") só viram data se a data da reunião for informada; ela será enviada no contexto.
- Responda somente com JSON válido no formato especificado.

Após validar:
1. Salvar em `transcripts.summary`.
2. **Inserir no conteúdo do item** um bloco "Resumo gerado" (Tiptap JSON) com seções Resumo, Tópicos, Decisões, Ações (como checklist) e Perguntas em aberto, **antes** do conteúdo existente. Criar versão `reason='ai'` antes da alteração.
3. Se o título do item estiver vazio ou for o padrão, usar `titulo_sugerido`.

**Na interface do item:**
- Botão "Gerar resumo novamente".
- Botão **"Criar tarefas das ações"**: abre lista revisável (editar descrição, prazo, espaço) e cria itens do tipo Tarefa ligados à reunião (`links` com `kind='relation'`).

## 2.8 Visualizador de transcrição

Componente `TranscriptViewer`:
- Player de áudio fixo no topo (sticky).
- Lista de segmentos com locutor (cor por locutor), tempo e texto.
- Clicar no segmento pula o áudio para aquele ponto; segmento atual destacado durante a reprodução (auto-scroll opcional).
- **Renomear locutores:** clicar em "Locutor A" e escolher nome (salva em `speaker_names`; na fase 3, permitir escolher um contato).
- Busca dentro da transcrição com navegação entre ocorrências.
- Corrigir texto de um segmento (edita `segments` e recompõe `text`).
- Exportar: `.txt`, `.md` (com locutores e tempos), `.srt`.
- Copiar resumo em Markdown.
- Status visível enquanto processa ("Transcrevendo… costuma levar alguns minutos").

## 2.9 Extração de texto de documentos (OCR)

Ao criar anexo, enfileirar `extract_attachment` quando o MIME for PDF, imagem, DOCX, TXT/MD/CSV.

**Job `extract_attachment`** `{ attachmentId }`:

| Tipo | Estratégia |
|---|---|
| `text/plain`, `text/markdown`, `text/csv` | Ler direto (limitar tamanho) → `plain` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `mammoth` → texto → `docx` |
| `application/pdf` | 1) Extrair camada de texto (ex.: `unpdf`). 2) Se a média for menor que ~100 caracteres por página, tratar como escaneado → OCR com Claude → `ai_ocr` |
| `image/*` | OCR com Claude → `ai_ocr` |

**OCR com Claude:**
- Enviar a imagem (base64) ou o PDF como bloco de documento, respeitando os limites atuais de tamanho e páginas da API (conferir na documentação). PDFs grandes: dividir em partes por páginas (ex.: `pdf-lib`).
- Prompt: transcrever fielmente todo o texto em Markdown, mantendo títulos, listas e tabelas; marcar trechos ilegíveis como `[ilegível]`; não resumir; não adicionar comentários.
- Registrar `usage_events` com `feature='ocr'`.

Após extrair: salvar `extracted_text`, `extraction_status='done'`, `page_count`; chamar `refresh_item_extra_text`.

**Na interface do anexo:**
- Aba "Texto extraído" com copiar e botão "Extrair novamente".
- Ação **"Criar nota a partir do documento"**: cria item com o texto em Markdown convertido para Tiptap e o anexo vinculado.
- Ação **"Resumir documento"**: resumo curto com Claude inserido no item.
- Opção nas configurações: OCR automático ligado/desligado (quando desligado, apenas o botão manual).

## 2.10 Captura de documentos pelo celular

Na captura rápida, botão **"Escanear"**: `<input type="file" accept="image/*" capture="environment" multiple>`. Várias fotos viram um item com anexos em ordem, extração de texto de cada uma e, opcionalmente, combinação em um único PDF no navegador (`pdf-lib`).

## 2.11 Testes da fase

**Unidade:**
- Backoff e transição de estados dos jobs.
- Normalização de segmentos do provedor (fixture JSON de resposta real salva em `tests/fixtures`).
- Formatação de transcrição com locutores e tempos; exportação `.srt`.
- `meetingSummarySchema` com respostas válidas e inválidas; conversão do resumo em blocos Tiptap.
- Heurística de PDF escaneado.
- Checagem de orçamento de IA.

**Integração (com mocks dos provedores):**
- Fluxo completo: upload → `transcribe_audio` → webhook → resumo → itens de tarefa.
- Webhook com assinatura inválida → 401; webhook repetido → sem duplicação.
- `/api/jobs/tick` sem segredo → 401.

**E2E:**
- Enviar arquivo de áudio curto de teste (com provedor mock) e ver transcrição e resumo no item.

## Definição de pronto da fase

- [ ] Fila de jobs com cron, retentativas e painel
- [ ] Gravação no navegador com recuperação e upload resumível
- [ ] Transcrição com locutores via provedor escolhido
- [ ] Resumo com decisões e ações; criação de tarefas
- [ ] Visualizador com player sincronizado, renomear locutores e exportações
- [ ] OCR de PDFs escaneados e imagens; DOCX e PDF com texto
- [ ] Texto de anexos e transcrições aparece na busca
- [ ] Controle de custo e orçamento de IA
- [ ] Testes passando e `PROGRESSO.md` atualizado
