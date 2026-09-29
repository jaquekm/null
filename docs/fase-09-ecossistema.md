# Fase 9 — Ecossistema: tudo ligado e funcionando sozinho

Origem: análise de usabilidade pedida pela dona em 29/09/2026 ("um ecossistema pessoal e empresarial
interligado e funcionando tudo no mesmo lugar"). Ela aprovou todas as ideias, a serem feitas **por fases,
uma de cada vez**, cada uma com PR próprio, testes e print conferido antes de declarar pronto.

Regras que valem pra todas as tarefas desta fase (além do `CLAUDE.md`):

- Uma tarefa por vez, na ordem abaixo; a próxima só começa com a anterior mergeada.
- Nada de conceito novo pra dona decorar se der pra reaproveitar o que já existe (tipos, tags como
  subcategorias, lembretes, links compartilhados, automações).
- Todo texto de interface em linguagem de uso ("me lembra amanhã"), não de sistema ("regra", "gatilho").
- Print de tela inteira (computador e celular, claro e escuro) antes de mandar pra dona.

## Pré-requisito [HUMANO] — ligar o agendador

Sem isso nada que depende de horário acontece sozinho (lembretes, disparos, automações, avisos de
vencimento das tarefas 9.4, 9.5 e 9.8).

- [ ] Criar no Vault do Supabase `cron_secret` (mesmo valor do `CRON_SECRET` da Vercel) e
  `app_url` = `https://null.prescrittomed.com.br`.
- [ ] Conferir: `cron.job_run_details` com sucesso, `/api/jobs/tick` respondendo 200 nos logs da Vercel,
  fila de `jobs` andando.

## 9.1 — Tela "Hoje" como página inicial ✅

- `/hoje`: data, saudação, resumo do dia, captura rápida, cartões de Agenda, Lembretes, Prazos
  (atrasados + de hoje), Contas a pagar (vencidas + próximos 7 dias), Treino (próximo treino do programa
  ativo) e Abertos recentemente; faixa do Inbox quando tem item esperando.
- Vira o início do app: `/` → `/hoje`, logo do menu, PWA (`start_url`), volta do login e fim do
  onboarding. Primeiro item do menu e da barra do celular.
- **Depois de a dona usar o Hoje por alguns dias:** enxugar o menu (Hoje, Espaços, Agenda, Buscar,
  Mais) — decidir com ela o que vai pro "Mais".

## 9.2 — Criar pelo objetivo: modelos no "+ Novo" ✅

- O "+ Novo" (e a captura) oferece modelos antes dos tipos: Lista de presentes, Lista de compras,
  Reunião, Documento com vencimento, Evento, Planilha de gastos, Nota.
- Cada modelo já escolhe o tipo, o tipo de lista, a subcategoria sugerida e um conteúdo inicial.
- Modelos são dados (JSON em `packs/` ou tabela), não código espalhado — dá pra criar os próprios depois.
- Aceite: criar "Ideias de presentes pra cunhada" em 2 toques, já como lista "Marcar vários".

## 9.3 — Reunião ponta a ponta ✅

- Evento na agenda → botão "Criar nota da reunião" (e automático pra eventos com convidados):
  pauta, participantes (contatos), link do evento.
- Na nota: gravar/transcrever (já existe), resumo (já existe), **tarefas com responsável e prazo**.
- "Enviar resumo aos participantes": link compartilhado + mensagem pronta (WhatsApp/e-mail).
- Lembretes de acompanhamento criados a partir das tarefas.
- Aceite: do evento ao resumo enviado sem sair da nota.

## 9.4 — Lembrete em qualquer coisa, em linguagem natural ✅

- "Me lembra…" em qualquer item e em itens de lista: "amanhã 9h", "sexta às 14h", "toda segunda",
  "dia 10 de todo mês" → parser puro com testes (fuso America/Sao_Paulo).
- Aviso antes de eventos da agenda (X minutos antes, por push ou WhatsApp).
- Depende do agendador ligado.

## 9.5 — Documentos importantes com vencimento ✅

- Tipo/modelo "Documento importante": validade (data), aviso 30, 7 e 1 dia antes.
- OCR (já existe) sugere a data de validade ao anexar a foto/PDF — a dona confirma, nunca automático.
- Cartão "Vencendo" no Hoje.

## 9.6 — Planilhas de verdade ✅ (em PR)

- Visão de tabela: linha de totais (soma, média, contagem por coluna numérica/dinheiro).
- Fórmulas simples entre colunas (ex.: `quantidade × preço`), com parser puro e testado.
- Importar e exportar Excel (.xlsx) direto da visão.

## 9.7 — Compartilhar mais que uma página

- Compartilhar um espaço ou uma subcategoria inteira (ex.: "Família"), só leitura por padrão.
- Aviso pra dona quando alguém comentar ou marcar item num link dela.
- QR code do link (eventos, listas pra imprimir).

## 9.8 — Automações em frases simples

- Editor "Quando [algo acontecer], [fazer algo]" com as opções escritas em português de uso.
- Receitas prontas pra ativar com um toque (ex.: "quando uma conta vencer amanhã, me avisar no WhatsApp").
- Depende do agendador ligado.

## 9.9 — Celular em primeiro lugar

- Captura por voz (transcrição já existe) direto do botão "+".
- Atalhos do app instalado (PWA shortcuts) pra Capturar, Hoje e Agenda.
- Funcionar sem internet: ler o que já foi aberto e guardar capturas pra enviar quando voltar.

## Fora desta fase (decidir depois com a dona)

- Abrir o JKode pra outros usuários (cadastro, planos, separação de contas, LGPD, custo de IA por pessoa).
  Sugestão: validar antes com 3–5 pessoas usando os links compartilhados.
