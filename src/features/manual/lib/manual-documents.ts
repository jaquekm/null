export interface ManualDocument {
  title: string;
  markdown: string;
}

/**
 * Conteúdo dos 3 documentos do manual (7.10) — Markdown, convertido pra
 * Tiptap na hora de gerar o item (`markdownToTiptapDoc`). Texto fixo aqui,
 * não gerado dinamicamente: são instruções pro dono, não dados do banco.
 */
export const MANUAL_DOCUMENTS: ManualDocument[] = [
  {
    title: "Como uso o Hub",
    markdown: `# Como uso o Hub

## Captura rápida

Qualquer coisa que aparecer — uma ideia, um link, uma tarefa — entra pelo **Capturar** (\`/capturar\`) ou direto pelo **Inbox** (\`/inbox\`). Nada precisa ser organizado no momento da captura: o Inbox existe justamente pra acumular sem decisão, e "Organizar em lote" (o painel de IA no topo do Inbox) sugere espaço, tipo e tags pra cada item quando chegar a hora de processar.

## Rotina diária

- Abrir o **Inbox** e processar o que chegou (mover pra um espaço, arquivar ou excluir — a meta é zerar, não deixar acumular).
- Conferir a **Agenda** (\`/agenda/hoje\`) e os **Lembretes** (\`/lembretes\`) do dia.
- Registrar lançamentos financeiros do dia em **Finanças → Lançamentos** (\`/financas/lancamentos\`), se relevante.

## Rotina semanal

- **Revisão semanal** (\`/revisao-semanal\`): resumo com IA do que aconteceu, itens sem categoria, tarefas paradas.
- Conferir **Configurações → Jobs** (\`/configuracoes/jobs\`) — nenhum job deveria estar com falha acumulada.
- Revisar assinaturas em **Configurações → Custos e economia** (\`/configuracoes/custos\`) — alguma já pode ser cancelada de verdade?

## Rotina mensal

- Fechar o mês em **Finanças → Orçamento** (\`/financas/orcamento\`) e conferir os cartões (\`/financas/cartoes\`).
- Conferir **Configurações → Uso e custo** (\`/configuracoes/uso\`) — gasto de IA dentro do esperado?
- Rodar o checklist trimestral de segurança quando cair o trimestre — ver o documento "Onde está cada segredo" deste manual e \`docs/rotacao-segredos.md\` no repositório.
- Conferir **Configurações → Backup** (\`/configuracoes/backup\`) — o último backup (diário do banco, semanal dos arquivos) está recente?
`,
  },
  {
    title: "Runbook de incidentes",
    markdown: `# Runbook de incidentes

Guia rápido pra quando algo parar de funcionar. Sem valores de segredo aqui — só o quê fazer e onde olhar (o documento "Onde está cada segredo" deste manual tem a referência de cada um).

## O site está fora do ar

1. Conferir o status do deploy no painel da Vercel.
2. Conferir \`/api/health\` — responde? Se responder com problema listado, o texto já indica qual.
3. Ver os logs da função na Vercel (erro 500 recorrente costuma ser variável de ambiente faltando ou o Supabase fora do ar).
4. Conferir o status do Supabase (painel do projeto — "Project status").

## Jobs parados (fila não anda)

1. Abrir **Configurações → Jobs** (\`/configuracoes/jobs\`) — quantos estão \`failed\`? Ver o erro de cada um.
2. Conferir se \`/api/jobs/tick\` está sendo chamado (cron externo — GitHub Actions ou o agendador configurado). Testar chamando manualmente com o segredo correto.
3. Se um job específico está preso em \`running\` há muito tempo, provavelmente travou no meio — mudar o \`status\` de volta pra \`queued\` no banco reencaminha pra nova tentativa.

## Google Calendar desconectado

1. **Configurações → Integrações** (\`/configuracoes/integracoes\`) mostra o status da conexão.
2. Se aparecer "revogado" ou erro de token, reconectar a conta Google pela mesma tela.
3. Depois de reconectar, o próximo \`calendar_sync\` (job periódico) já ressincroniza sozinho — não precisa forçar nada.

## WhatsApp/mensageria falhando

1. Conferir **Configurações → Uso e custo** e o histórico de \`reminder_deliveries\` com \`status: 'failed'\` — o erro registrado costuma indicar se é credencial expirada ou número inválido.
2. Conferir a integração configurada (N8N/provedor de WhatsApp — ver \`docs/n8n-whatsapp.md\` no repositório) — o fluxo externo pode estar desligado ou com token vencido.
3. Webhooks de entrega (\`/api/webhooks/messaging\`) exigem o segredo correto — se o provedor girou a chave, atualizar a variável de ambiente.

## Restaurar de um backup

Runbook completo, passo a passo, em \`docs/restauracao.md\` no repositório do projeto — cobre restauração do banco (dump criptografado) e dos arquivos (Storage). Antes de restaurar de verdade, confirmar qual é o backup mais recente em **Configurações → Backup** (\`/configuracoes/backup\`).
`,
  },
  {
    title: "Onde está cada segredo",
    markdown: `# Onde está cada segredo

Sem valores — só onde cada coisa mora e quando trocar. Passo a passo completo de rotação em \`docs/rotacao-segredos.md\` no repositório.

## Segredos da aplicação (Vercel)

| Segredo | Onde configurar | Rotacionar quando |
| --- | --- | --- |
| \`ENCRYPTION_KEY\` / \`ENCRYPTION_KEY_PREVIOUS\` | Vercel → variáveis de ambiente | A cada 6–12 meses, ou se suspeitar de vazamento |
| \`CRON_SECRET\` | Vercel → variáveis de ambiente | Se vazar, ou revisão anual |
| \`N8N_WEBHOOK_SECRET\` | Vercel → variáveis de ambiente | Junto com a rotação do N8N |
| \`BACKUP_REPORT_SECRET\` | Vercel **e** GitHub Actions (os dois precisam do mesmo valor) | Junto com os segredos de backup |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Vercel → variáveis de ambiente | Só se vazar (é uma chave sensível do painel do Supabase) |
| \`SENTRY_DSN\` / \`NEXT_PUBLIC_SENTRY_DSN\` | Vercel → variáveis de ambiente | Não é segredo sensível — só se recriar o projeto no Sentry |

## Segredos de backup (GitHub Actions)

Todos em **Settings → Secrets and variables → Actions** do repositório: \`SUPABASE_DB_URL\`, \`BACKUP_AGE_PUBLIC_KEY\` (a chave privada \`age\` fica **fora** do repositório, num gerenciador de senhas), \`BACKUP_S3_*\` (endpoint/bucket/credenciais do bucket externo), \`SUPABASE_STORAGE_S3_*\` (credenciais S3 do Storage do Supabase). Rotacionar a chave de acesso do bucket a cada 6–12 meses.

## Tokens gerados pelo próprio Hub

- **Tokens de API/MCP**: gerados e revogados em **Configurações → Tokens** (\`/configuracoes/tokens\`) e **Configurações → MCP** (\`/configuracoes/mcp\`) — guardados só como hash, o valor puro só aparece uma vez na hora de criar.
- **Links compartilhados**: cada um tem prazo de validade próprio, configurado na hora de criar o link (não é um "segredo" de longa duração).

## Conexões de terceiros

- **Google Calendar**: tokens OAuth guardados criptografados (\`google_connections\`) — reconectar em **Configurações → Integrações** se expirar ou for revogado, não precisa mexer em variável de ambiente nenhuma.

## Revisão trimestral

Checklist completo em \`docs/rotacao-segredos.md\`: links compartilhados antigos, tokens sem uso, conexão do Google, \`pnpm security:check\` + Security Advisor do Supabase.
`,
  },
];
