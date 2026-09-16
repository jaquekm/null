# Como usar este planejamento com o Claude Code

## O que tem neste pacote

```
CLAUDE.md                              ← regras do projeto (o Claude Code lê automaticamente)
COMO-USAR-COM-CLAUDE-CODE.md           ← este guia
docs/
  00-visao-geral.md                    ← arquitetura, princípios, roadmap
  fase-00-fundacao.md                  ← projeto, login com MFA, deploy no subdomínio
  fase-01-nucleo.md                    ← notas, tipos, captura, inbox, busca, versões
  fase-02-midia-transcricao.md         ← jobs, gravação, transcrição, resumo, OCR
  fase-03-agenda-lembretes-compartilhamento.md
  fase-04-financas.md
  fase-05-metodos-automacoes.md        ← CRM, estudos, projetos, listas, canvas
  fase-06-relatorios-ia-mcp.md
  fase-07-operacao-backup-migracao.md
  PROGRESSO.md                         ← checklist de todas as tarefas
  decisoes.md                          ← registro de decisões
```

## Passo 1 — Preparar o repositório

1. Crie o repositório privado no GitHub e clone na sua máquina.
2. Copie **todo o conteúdo deste pacote para a raiz** do repositório (o `CLAUDE.md` precisa ficar na raiz).
3. Faça o primeiro commit: `docs: planejamento inicial`.
4. Abra o Claude Code na pasta do repositório.

> Na tarefa 0.2 o Next.js é criado. Como a pasta já terá arquivos, peça ao Claude Code para criar o projeto em uma pasta temporária e mover os arquivos para a raiz, sem apagar `CLAUDE.md` e `docs/`.

## Passo 2 — Primeira conversa

Cole este prompt:

```
Leia o CLAUDE.md e os documentos docs/00-visao-geral.md e docs/fase-00-fundacao.md.
Depois me diga, em poucas linhas:
1. Se entendeu o objetivo do projeto e as regras.
2. O que eu preciso fazer manualmente antes de você começar (tarefas [HUMANO]).
3. Qualquer ponto do plano que pareça incorreto ou desatualizado para as versões atuais das bibliotecas.
Não escreva código ainda.
```

## Passo 3 — Ritmo de trabalho por tarefa

Para cada tarefa, use este prompt (troque o número):

```
Vamos fazer a tarefa 1.6 de docs/fase-01-nucleo.md.
Antes de codar, apresente um plano curto: arquivos que vai criar ou alterar e como vai testar.
Depois implemente, rode lint, typecheck e testes, e atualize docs/PROGRESSO.md.
```

Dicas:
- **Uma tarefa por vez.** Tarefas grandes (ex.: 1.15 Visões, 4.5 Importação) podem ser divididas: "faça só a visão de tabela da tarefa 1.15".
- **Revise o plano antes de aprovar.** É mais barato corrigir o plano do que o código.
- **Use o modo de planejamento** do Claude Code nas tarefas de migration e segurança.
- **Commit ao final de cada tarefa**, depois de testar você mesmo no navegador.
- Se uma conversa ficar longa, comece outra e peça para ler o `CLAUDE.md`, a fase atual e o `PROGRESSO.md`.

## Passo 4 — Ao terminar cada fase

```
Terminamos as tarefas da fase 2. Faça uma revisão da fase:
1. Confira cada item da "Definição de pronto" em docs/fase-02-midia-transcricao.md.
2. Rode todos os testes, incluindo e2e.
3. Verifique RLS de todas as tabelas novas e rotas públicas novas.
4. Liste o que ficou pendente ou foi feito diferente do plano.
```

Depois:
1. Use o sistema de verdade por alguns dias.
2. Anote o que incomodou e ajuste antes de avançar.
3. Aplique as migrations em produção (**você autoriza**): `supabase link --project-ref <prod>` e `supabase db push`.
4. Cancele a assinatura que a fase substitui e registre no painel de economia (fase 7.8).

## Ordem recomendada

```
Fase 0 → Fase 1 → Backup (7.1 a 7.3) → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → restante da Fase 7
```

Pode trocar a ordem das fases 2 a 5 conforme o que te dá mais economia primeiro, respeitando as dependências:

| Fase | Depende de |
|---|---|
| 2 Mídia | 1 |
| 3 Agenda e lembretes | 2 (fila de jobs) |
| 4 Finanças | 3 (contatos, lembretes, links) |
| 5 Métodos | 4 (ações de conta a receber no CRM) — pode começar após a 3 se deixar essas ações para depois |
| 6 Relatórios e IA | 5 (para relatórios de vendas e estudos) |

## O que você vai precisar ter em mãos

| Quando | O quê |
|---|---|
| Fase 0 | Contas GitHub, Supabase (2 projetos), Vercel; acesso ao DNS; Docker e Supabase CLI |
| Fase 2 | Chave da API do Claude; conta no provedor de transcrição |
| Fase 3 | Projeto no Google Cloud; conta no Resend e DNS de e-mail; fluxo N8N + WhatsApp |
| Fase 4 | Extratos OFX/CSV dos seus bancos; chave Pix |
| Fase 6 | Conta no provedor de embeddings |
| Fase 7 | Bucket externo para backup; chave `age` guardada com segurança |

## Cuidados importantes

- **Pontos marcados para conferir na documentação atual** (versões do Next.js, limites de APIs, regras do Google e do WhatsApp, preços) existem porque mudam com frequência. Peça ao Claude Code para verificar antes de implementar.
- **Nunca cole chaves secretas no chat.** Coloque-as no `.env.local` você mesmo.
- **Dados reais só depois do backup externo funcionando.**
- **Valide o Pix** com um valor de R$ 0,01 no app do banco antes de enviar cobranças.
- **Mensagens para terceiros** só com consentimento registrado e respeitando as regras do WhatsApp.
