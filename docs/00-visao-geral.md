# 00 — Visão geral e arquitetura

## Objetivo

Um único sistema pessoal, hospedado em um subdomínio próprio (ex.: `app.seudominio.com.br`), que concentra
organização pessoal e profissional e substitui assinaturas de apps de notas, transcrição, CRM, finanças,
flashcards, documentação e lembretes.

**Regra de ouro do roadmap:** cada fase precisa ser usável no dia a dia assim que termina, e idealmente
permitir cancelar pelo menos uma assinatura.

## Princípios

1. **Um usuário.** Não há multiusuário, times ou planos. Terceiros interagem só por links de compartilhamento.
2. **Configurável por dados.** Espaços, tipos de objeto, campos, visões, templates e automações são registros no banco.
3. **Tudo é um item.** Notas, tarefas, reuniões, oportunidades de venda, cursos e documentos são `items` com um `type`.
   Módulos com regras próprias (finanças, agenda, contatos, lembretes) têm tabelas dedicadas e se ligam a itens.
4. **Integrar em vez de reconstruir.** Google Calendar para agenda, APIs para transcrição, OCR e IA, N8N/WhatsApp e Resend para mensagens.
5. **Os dados são do dono.** Exportação completa a qualquer momento, backups externos, nada preso a um provedor.
6. **Seguro por padrão.** RLS em tudo, MFA, tokens com hash, links com expiração, cadastro público desligado.

## Arquitetura

```
                        ┌──────────────────────────────────────────┐
  Navegador / PWA  ───► │  Next.js na Vercel (app.seudominio...)   │
  Atalho iOS/Android    │  - Páginas autenticadas (App Router)     │
  Bookmarklet ────────► │  - Server Actions                        │
                        │  - /api/capture   (token pessoal)        │
  Clientes/família ───► │  - /p/[token]     (links públicos)       │
                        │  - /api/webhooks/* (provedores)          │
  Claude (MCP) ───────► │  - /api/mcp       (token com escopo)     │
                        │  - /api/jobs/tick (fila de tarefas)      │
                        └───────┬──────────────────────┬───────────┘
                                │                      │
                    ┌───────────▼─────────┐   ┌────────▼──────────────────────┐
                    │ Supabase            │   │ Serviços externos             │
                    │ Postgres + RLS      │   │ - Claude API (resumo, OCR, IA)│
                    │ Auth + MFA          │   │ - Transcrição (API c/ webhook)│
                    │ Storage (anexos)    │   │ - Embeddings                  │
                    │ pg_cron ──► tick    │   │ - Google Calendar             │
                    │ pgvector, Vault     │   │ - Resend (e-mail)             │
                    └─────────────────────┘   │ - N8N → WhatsApp              │
                                              │ - Web Push                    │
                                              └───────────────────────────────┘
```

### Fila de tarefas (jobs)

Tudo que é lento ou agendado (transcrição, OCR, resumo, envio de lembretes, sincronização de agenda,
indexação para IA, relatórios agendados) vira um registro na tabela `jobs`. O `pg_cron` do Supabase chama
`/api/jobs/tick` a cada minuto. O tick reserva jobs com `FOR UPDATE SKIP LOCKED`, executa dentro do limite de
tempo da função e registra sucesso ou falha com nova tentativa (backoff exponencial).

### Modelo de dados (resumo)

| Área | Tabelas principais | Fase |
|---|---|---|
| Base | `user_settings` | 0 |
| Núcleo | `spaces`, `object_types`, `items`, `tags`, `item_tags`, `links`, `attachments`, `item_versions`, `views`, `api_tokens` | 1 |
| Processamento | `jobs`, `job_schedules`, `transcripts`, `usage_events` | 2 |
| Pessoas e tempo | `contacts`, `item_contacts`, `google_connections`, `calendars`, `events`, `reminders`, `reminder_deliveries`, `reminder_rules`, `push_subscriptions` | 3 |
| Compartilhamento | `share_links`, `share_link_views`, `share_comments` | 3 |
| Finanças | `fin_accounts`, `fin_categories`, `fin_transactions`, `fin_recurring`, `fin_bills`, `fin_card_statements`, `fin_imports`, `fin_rules`, `fin_splits`, `fin_split_shares` | 4 |
| Métodos | `packs_installed`, `automations`, `automation_runs`, `canvases`, `canvas_nodes`, `canvas_edges`, `review_cards`, `review_logs`, `study_sessions` | 5 |
| Relatórios e IA | `report_definitions`, `report_runs`, `item_chunks`, `ai_conversations`, `ai_messages`, `mcp_audit` | 6 |
| Operação | `backup_runs`, `subscriptions_tracker` | 7 |

## Roadmap

| Fase | Entrega | Substitui | Duração estimada* |
|---|---|---|---|
| 0 | Fundação: projeto, login com MFA, deploy no subdomínio, CI | — | 1 semana |
| 1 | Núcleo: espaços, tipos, itens, editor, captura, inbox, busca, anexos, versões, visões | App de notas | 3–4 semanas |
| 2 | Mídia: gravação, transcrição com locutores, resumo de reuniões, OCR | App de transcrição | 2–3 semanas |
| 3 | Agenda, contatos, lembretes (WhatsApp, e-mail, push) e links compartilhados | Apps de lembrete/agenda | 3–4 semanas |
| 4 | Finanças: contas, cartões, importação, contas a pagar/receber, divisão de contas, Pix | App de finanças e de dividir contas | 3–4 semanas |
| 5 | Métodos e automações: vendas, estudos com flashcards, projetos, listas, mudanças, canvas | CRM, Anki, gestor de projetos | 3–4 semanas |
| 6 | Relatórios, busca semântica, "pergunte à sua base", servidor MCP | Base de conhecimento com IA | 3 semanas |
| 7 | Operação: backup externo, exportação, importação de outros apps, monitoramento | — | 1–2 semanas |

\* Ritmo de meio período. As estimativas servem para planejar, não como prazo.

A **Fase 7.1 (backup)** deve ser antecipada para logo depois da Fase 1 se dados importantes já estiverem no sistema.

## Integrações externas e custos variáveis

| Serviço | Uso | Observação |
|---|---|---|
| Supabase | Banco, auth, storage, cron | Gratuito para começar; plano pago para backups e arquivos grandes |
| Vercel | Hospedagem | Conferir limites de duração de funções do plano |
| Claude API | Resumos, OCR, IA, flashcards | Custo por token; controle em `usage_events` |
| Transcrição | Áudio → texto com locutores | Escolher provedor que aceite URL + webhook + pt-BR + diarização |
| Embeddings | Busca semântica | Provedor com bom suporte a português |
| Google Calendar API | Agenda | Gratuito |
| Resend | E-mail | Plano gratuito costuma bastar para uso pessoal |
| WhatsApp (via N8N) | Lembretes | API oficial cobra por conversa/mensagem; templates aprovados fora da janela de 24h |

Preços e limites mudam: confirmar na documentação de cada serviço antes de implementar.

## Glossário

- **Espaço:** contexto de organização (Pessoal, Trabalho, uma empresa, Estudos).
- **Tipo de objeto:** molde de item com campos (ex.: "Reunião", "Oportunidade", "Livro").
- **Item:** qualquer registro de conteúdo (nota, tarefa, reunião...).
- **Propriedades:** valores dos campos do tipo, guardados em `items.properties` (jsonb).
- **Visão:** forma de exibir itens (lista, tabela, kanban, calendário, galeria, linha do tempo, canvas).
- **Pack (método):** conjunto instalável de tipos, visões, templates e automações (ex.: PARA, CRM, Estudos).
- **Inbox:** itens capturados ainda não organizados.
- **Job:** tarefa assíncrona na fila.
- **Link de compartilhamento:** URL `/p/[token]` com permissão e validade, para quem não tem conta.
