# Fase 7 — Operação: backup, exportação, importação de outros apps, monitoramento e manutenção

**Objetivo:** garantir que os dados nunca se percam, que seja fácil sair ou migrar, que falhas sejam percebidas rapidamente e que o sistema continue seguro e barato ao longo do tempo.

**Entregável usável:** backups diários fora do Supabase testados, exportação completa em um clique, importação de notas de outros apps, alertas de falha e painel de custos e economia.

**Pré-requisito:** Fase 6 concluída. **Exceção:** a tarefa **7.1 (backup)** deve ser feita logo após a Fase 1 se dados importantes já estiverem no sistema.

---

## 7.1 Backup externo do banco

**Por quê:** backups do próprio provedor não protegem contra erro de configuração, conta comprometida ou exclusão acidental do projeto.

**[HUMANO]:**
1. Criar um destino de armazenamento **fora** do Supabase e da Vercel, compatível com S3 (ex.: Cloudflare R2 ou Backblaze B2), em bucket privado com versionamento e regra de retenção.
2. Criar chave de acesso restrita a esse bucket.
3. Gerar par de chaves de criptografia com `age` (`age-keygen`) e **guardar a chave privada fora do repositório e fora do servidor** (ex.: gerenciador de senhas).
4. Adicionar secrets no GitHub: `SUPABASE_DB_URL` (string de conexão do pooler de sessão ou direta, com senha), `BACKUP_AGE_PUBLIC_KEY`, credenciais do bucket.

**Workflow `.github/workflows/backup.yml`** (agendado diariamente às 03:00 BRT e manual):
1. Instalar cliente PostgreSQL na mesma versão principal do banco do Supabase (conferir no dashboard) e `age`.
2. Dump:
   ```bash
   pg_dump "$SUPABASE_DB_URL" \
     --format=custom --no-owner --no-privileges \
     --schema=public --schema=auth --schema=storage \
     --file=hub-$(date +%F).dump
   ```
   Avaliar com a documentação atual do Supabase quais schemas incluir (o `auth` contém o usuário e fatores MFA) e se `supabase db dump` é preferível para roles e schema.
3. Criptografar: `age -r "$BACKUP_AGE_PUBLIC_KEY" -o hub-$(date +%F).dump.age hub-$(date +%F).dump`.
4. Enviar ao bucket com `rclone` ou `aws s3 cp` em `db/AAAA/MM/`.
5. Retenção: diários por 30 dias, mensais (dia 1) por 12 meses (regra de ciclo de vida no bucket ou limpeza no workflow).
6. Registrar resultado: chamar `POST /api/ops/backup-report` (autenticado por segredo) que grava em `backup_runs`; em falha, o job do GitHub também envia e-mail/push.

## 7.2 Backup dos arquivos (Storage)

Workflow semanal (e manual) `storage-backup.yml`:
- Usar o endpoint compatível com S3 do Supabase Storage (credenciais geradas no dashboard) com `rclone sync` do bucket `attachments` para `storage/` no destino de backup. Conferir disponibilidade do endpoint S3 no plano.
- Alternativa se o endpoint não estiver disponível: script Node que lista objetos por `storage.objects` e baixa por URL assinada, enviando apenas os que mudaram (comparar tamanho/data).
- Criptografia: habilitar criptografia do lado do servidor no bucket de destino (e, se desejado, `rclone crypt`).

## 7.3 Registro e teste de restauração

Migration `operacao`:

```sql
create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('database', 'storage', 'restore_test', 'export')),
  status text not null check (status in ('success', 'failed')),
  size_bytes bigint,
  location text,
  detail text,
  created_at timestamptz not null default now()
);

create table public.subscriptions_tracker (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,                       -- ex.: app de notas antigo
  monthly_cost_cents bigint not null,
  currency text not null default 'BRL',
  status text not null default 'active' check (status in ('active', 'canceled')),
  replaced_by_phase text,                   -- 'Fase 1', 'Fase 2'...
  canceled_on date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.backup_runs enable row level security;
alter table public.subscriptions_tracker enable row level security;
create policy "owner_all" on public.backup_runs for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner_all" on public.subscriptions_tracker for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
```

**Teste mensal de restauração** (workflow manual `restore-test.yml` + documento `docs/restauracao.md`):
1. Baixar o backup mais recente e descriptografar (a chave privada é informada como secret temporário ou o passo é feito localmente pelo dono).
2. Restaurar em um Postgres descartável (container no runner) com `pg_restore`.
3. Rodar consultas de verificação: contagem de `items`, `fin_transactions`, `contacts`; soma dos saldos; item mais recente.
4. Registrar `restore_test` em `backup_runs`.
5. Push de lembrete mensal para o dono executar/confirmar.

`docs/restauracao.md` deve ter o passo a passo completo para **recuperar tudo em um projeto Supabase novo** (banco, storage, variáveis, DNS), escrito para ser seguido sob pressão.

Página `/configuracoes/backup`: último backup de banco e de arquivos, último teste de restauração, alertas se passar de 48 h sem backup ou 45 dias sem teste.

## 7.4 Exportação completa

Botão **"Exportar tudo"** em `/configuracoes/dados` → job `export_all` → arquivo `.zip` no Storage com link de download válido por 24 h e notificação:

```
hub-export-AAAA-MM-DD/
  README.md                     # explica a estrutura
  espacos/<espaço>/<tipo>/<titulo-slug>--<id-curto>.md
      (front matter YAML: id, tipo, espaço, tags, status, datas, propriedades legíveis,
       links como [[titulo]]; corpo em Markdown)
  anexos/<item-id>/<arquivo>
  transcricoes/<item-id>.md     # com locutores e tempos
  canvas/<item-id>.json
  contatos/contatos.csv
  contatos/contatos.vcf
  financas/contas.csv
  financas/lancamentos.csv
  financas/contas_a_pagar_receber.csv
  financas/divisoes.csv
  estudos/flashcards.csv        # compatível com importação do Anki (frente;verso;baralho)
  agenda/eventos.ics
  configuracao/tipos.json
  configuracao/visoes.json
  configuracao/automacoes.json
  configuracao/packs.json
  dados-brutos/<tabela>.json    # dump JSON de todas as tabelas do usuário
```

- Processamento em streaming para não estourar memória (ex.: `archiver` gravando por partes no Storage, ou dividir em múltiplos zips por tamanho).
- Markdown compatível com Obsidian (wikilinks por título, pastas por espaço).
- Registrar `export` em `backup_runs`.
- Exportações parciais: um espaço, um tipo, um período financeiro.

## 7.5 Importação de outros apps

Página `/configuracoes/importar` com assistente por origem. Todas as importações: pré-visualização, escolha de espaço e tipo de destino, mapeamento de tags, detecção de duplicados por título + data, relatório final e **desfazer** (itens marcados com `properties._import_id` ou tabela de lote).

| Origem | Formato | Detalhes |
|---|---|---|
| Evernote | `.enex` (XML) | Notas com ENML → converter para HTML → Tiptap; recursos (anexos) em base64 com hash MD5 referenciado por `<en-media>`; tags; datas de criação/atualização; cadernos → espaço ou tag |
| Notion | Exportação "Markdown & CSV" (.zip) | Páginas `.md` com hierarquia de pastas → `parent_id`; bancos de dados CSV → tipo com campos inferidos (confirmar tipos na tela); links internos → resolver por nome do arquivo |
| Obsidian / Markdown | Pasta ou .zip | Front matter YAML → propriedades; `[[wikilinks]]` → links (segunda passada após criar todos os itens); `#tags`; anexos referenciados |
| Google Keep | Google Takeout (JSON) | Notas e checklists, cores → tags, anexos |
| Anki | CSV/TXT | Já feito na fase 5 |
| Contatos | vCard/CSV | Já feito na fase 3 |
| Bancos | OFX/CSV | Já feito na fase 4 |
| Calendário | `.ics` | Eventos antigos para histórico (somente leitura, calendário local "Importado") |

Parsers como funções puras com fixtures de exemplo em `tests/fixtures/import/` e testes.

## 7.6 Monitoramento e alertas

- **Erros:** integrar Sentry (ou similar) no Next.js para servidor e cliente, com `beforeSend` removendo conteúdo de notas, valores financeiros e dados de contatos dos eventos. Taxa de amostragem baixa de performance.
- **Disponibilidade:** monitor externo (serviço gratuito de uptime) consultando `/api/health` a cada 5 min, com alerta por e-mail/Telegram.
- **Health check ampliado** `GET /api/health?deep=1` (protegido por `CRON_SECRET`): testa consulta ao banco, último tick de jobs (< 5 min), jobs com falha nas últimas 24 h, último backup (< 48 h), conexão Google ativa.
- **Job `ops_daily_check`** (diário 08:00): verifica os mesmos pontos e manda um push/e-mail só se houver problema: jobs falhando, backup atrasado, Google desconectado, orçamento de IA acima de 80%, tokens MCP expirando em 7 dias, links compartilhados sem validade antigos, uso de Storage perto do limite do plano.
- **Logs estruturados** em route handlers e jobs (`console.log(JSON.stringify({ level, msg, jobId, kind }))`), sem dados sensíveis.

## 7.7 Segurança contínua

**Checklist executável** (`pnpm security:check`, script que roda testes e consultas):
- [ ] Todas as tabelas de `public` com RLS habilitado (consulta em `pg_tables`/`pg_class.relrowsecurity`); falhar se alguma não tiver.
- [ ] Nenhuma política permite `anon`.
- [ ] Funções `security definer` com `search_path` definido e sem `execute` para `anon`/`authenticated` quando forem internas.
- [ ] Cadastro público desativado (verificação manual documentada).
- [ ] Bucket `attachments` privado.
- [ ] Nenhuma chave secreta em código cliente (busca por padrões no bundle de build).
- [ ] Cabeçalhos de segurança presentes.
- [ ] Rotas públicas exigem segredo/assinatura/token.

Rodar também o **Security Advisor / linter** do Supabase e corrigir os avisos.

**Rotinas:**
- Dependabot (ou Renovate) semanal para dependências, com CI obrigatório.
- Rotação a cada 6–12 meses: `CRON_SECRET`, `N8N_WEBHOOK_SECRET`, tokens MCP. `ENCRYPTION_KEY` com suporte a **duas chaves** (atual e anterior) no `crypto.ts` para permitir rotação e recriptografia por job.
- Revisão trimestral de links compartilhados ativos e tokens.
- **LGPD e contatos:** tela para exportar e excluir definitivamente os dados de um contato a pedido (inclui entregas de mensagens e partes de divisões, anonimizando o nome nos registros financeiros que precisam ser mantidos).

## 7.8 Custos e economia

Página `/configuracoes/custos`:
- **Assinaturas substituídas** (`subscriptions_tracker`): cadastrar apps que você pagava, marcar como cancelado e em qual fase; total economizado por mês e acumulado.
- **Custos do Hub:** entrada manual mensal de Supabase, Vercel, domínio e bucket de backup; custos variáveis vindos de `usage_events` (IA, transcrição, embeddings, WhatsApp).
- **Saldo:** economia mensal − custo mensal, com gráfico ao longo do tempo.

## 7.9 Desempenho e limpeza

- Revisar consultas lentas (Query Performance do Supabase) e criar índices faltantes via migration.
- Paginação por cursor em listas grandes (itens, lançamentos, entregas).
- Imagens: gerar miniaturas no upload (redimensionar no navegador antes de enviar ou transformações de imagem do Supabase se disponíveis no plano).
- Jobs de limpeza (diários): `jobs` concluídos com mais de 30 dias, `share_link_views` com mais de 180 dias, `automation_event_log` com mais de 7 dias, eventos cancelados com mais de 30 dias, exportações com mais de 7 dias.
- `VACUUM`/`ANALYZE` são automáticos no Supabase; monitorar tamanho do banco na página de backup.

## 7.10 Manual do sistema

Criar dentro do próprio Hub (itens do tipo Documento, espaço "Hub"), via seed opcional:
- **Como uso o Hub:** fluxo de captura, rotina diária/semanal/mensal.
- **Runbook de incidentes:** site fora do ar, jobs parados, Google desconectado, WhatsApp falhando, restauração de backup (link para `docs/restauracao.md`).
- **Onde está cada segredo** (sem os valores): quais serviços, onde configurar, quando rotacionar.

## 7.11 Testes da fase

- Parsers de importação (ENEX com anexos, Notion CSV, Obsidian com wikilinks e front matter, Keep JSON) com fixtures.
- Exportação: gerar para um conjunto de fixture e validar estrutura, front matter e CSV (separador `;`, BOM).
- Ida e volta: exportar em Markdown e importar como Obsidian recria itens e links equivalentes.
- `security:check` rodando no CI.
- Workflow de backup executado manualmente com sucesso e restauração testada ao menos uma vez.

## Definição de pronto da fase

- [ ] Backup diário do banco e semanal dos arquivos, criptografados e fora do Supabase
- [ ] Restauração testada e documentada
- [ ] Exportação completa e parcial
- [ ] Importação de Evernote, Notion, Obsidian/Markdown e Keep
- [ ] Monitoramento de erros, uptime e verificação diária
- [ ] Checklist de segurança automatizado no CI
- [ ] Painel de custos e economia
- [ ] Manual e runbooks dentro do Hub
- [ ] `PROGRESSO.md` atualizado

---

## Depois da Fase 7: ideias para o futuro

Registrar aqui e decidir com base no uso real:
- App offline-first com sincronização local (maior mudança de arquitetura).
- OAuth 2.1 no servidor MCP para conectores que exigirem.
- Integração com e-mail (ler e-mails de clientes e ligar a contatos/oportunidades).
- Leitura automática de notas fiscais e boletos recebidos por e-mail.
- Portal do cliente (visão compartilhada de projeto com vários itens).
- Modelos de proposta com assinatura eletrônica.
