# Fase 8 — Portal do cliente, propostas com assinatura e integração de e-mail

**Objetivo:** fechar o ciclo comercial dentro do próprio Hub — compartilhar um projeto inteiro com o cliente (não só um item), assinar propostas eletronicamente, e ler e-mails de clientes automaticamente para ligá-los a contatos/oportunidades e para lançar boletos/notas fiscais recebidos sem digitar nada. Também paga a dívida técnica registrada no fim da Fase 6/7: OAuth 2.1 no servidor MCP, se algum conector exigir.

**Entregável usável:** mandar pro cliente um link só, com todos os itens do projeto dele; ele assina a proposta ali mesmo, sem sair do navegador; um boleto que chega por e-mail já aparece como conta a pagar pendente de confirmação, sem o dono digitar nada. Ideal pra cancelar uma ferramenta paga de proposta/assinatura (DocuSign, PandaDoc etc.) e reduzir lançamento manual de contas.

**Pré-requisito:** Fase 7 concluída.

**Princípio desta fase:** reaproveitar o que já existe em vez de reconstruir — o tipo "Proposta" (pack CRM, fase 5), o mecanismo de `share_links`/`/p/[token]` (fase 3), a conexão OAuth do Google já usada pra Calendar (fase 3) e a extração de boleto por IA que já existe pras finanças (fase 4). Nenhuma tarefa desta fase cria um sistema de assinatura eletrônica "de verdade" (nível qualificado/ICP-Brasil) — é um registro de consentimento (nome digitado, checkbox, IP, hora, hash do documento), suficiente pra uso entre o dono e clientes de confiança, não pra contratos que exijam validade jurídica forte. Registrar essa limitação pro dono decidir caso a caso.

---

## 8.1 Portal do cliente (compartilhamento de projeto com vários itens)

**Por quê:** hoje um link de compartilhamento (`share_links.resource_type`) só aponta pra **um** recurso (`item`, `list`, `split`, `report` ou `bill`). Um projeto de verdade tem vários itens (proposta, contrato, atas de reunião, arquivos) que o dono hoje precisa compartilhar um por um.

- Migration nova: adicionar `'project'` ao `check` de `share_links.resource_type`. `resource_id` aponta pro item "pai" (ex.: um item do tipo Projeto, pack PARA/Projetos da fase 5) — os itens filhos vêm de `items.parent_id` (já existe) ou de um relacionamento explícito guardado em `properties` (o pack de Projetos já usa isso pra vincular tarefas), decidir na implementação qual dos dois já cobre o caso sem duplicar dado.
- Nova função `getPublicProjectResource` (`src/features/sharing/queries.ts`, ao lado das outras `getPublic*Resource`) — busca o item pai e os filhos, monta uma árvore rasa (2 níveis, sem recursão infinita).
- Página pública nova em `src/app/p/[token]/` (branch de `resourceType === 'project'`, mesmo padrão das outras) — lista os itens filhos com link pra cada um dentro do mesmo token (sem exigir login, mesmo princípio de sempre), respeitando `permission` (`view`/`comment`) e `include_attachments` que já existem na tabela.
- Reaproveitar `createShareLink`/`revokeShareLink` (`src/features/sharing/actions.ts`) sem mudar assinatura — só o `resourceType` novo.
- UI: no painel do item Projeto, um botão "Compartilhar projeto" ao lado do "Compartilhar item" que já existe.

## 8.2 Propostas com assinatura eletrônica

**Por quê:** o tipo "Proposta" (pack CRM, `packs/crm.json`) já existe com `status` (rascunho/enviada/aceita/recusada) e um arquivo anexo — falta o cliente poder aceitar formalmente sem o dono ter que marcar "aceita" manualmente depois de uma ligação/e-mail.

- Novo `permission` em `share_links`: `'sign'` (ao lado de `view`/`comment`/`check`/`settle` que já existem) — um link de proposta com essa permissão mostra um botão "Aceitar e assinar" na página pública, em vez de só leitura.
- Nova tabela `proposal_signatures`:
  ```sql
  create table public.proposal_signatures (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    item_id uuid not null references public.items(id) on delete cascade,   -- o item Proposta
    share_link_id uuid not null references public.share_links(id) on delete cascade,
    signer_name text not null,
    signer_email text,
    document_sha256 text not null,   -- hash do conteúdo/arquivo no momento da assinatura — evita "assinei uma coisa, o dono mudou depois"
    ip_address text,
    user_agent text,
    signed_at timestamptz not null default now(),
    created_at timestamptz not null default now()
  );
  ```
  RLS `owner_all` de sempre — só o dono lê/lista, o `INSERT` público acontece via `createClient()` de service role na própria action pública (mesmo padrão de `share_comments`/`share_link_views`, que também são preenchidos por visitante anônimo sob um token).
- Ação pública `signProposal(token, { signerName, signerEmail })` (`src/features/sharing/actions-public.ts`): valida o token/permissão, calcula o hash do documento (Tiptap `content` serializado ou o `file` anexo, o que for a fonte de verdade da proposta), grava a linha de assinatura, atualiza `items.properties.status = 'aceita'` e `sent_at`/campo equivalente do pack, e dispara `notifyOwner` (mesma função já usada em outros avisos) avisando que a proposta X foi assinada.
- Painel do item Proposta ganha uma seção "Assinatura" mostrando nome/e-mail/data/IP de quem assinou, quando existir uma linha em `proposal_signatures`.
- **Limitação a registrar na tela e no manual do sistema (7.10)**: isto é um registro de consentimento (clique + dados capturados), não uma assinatura digital certificada — atualizar o documento "Onde está cada segredo"/manual não se aplica aqui, mas vale um aviso na própria tela de proposta ("Assinatura eletrônica simples — sem validade de certificado digital").

## 8.3 Integração com e-mail (ler e ligar e-mails de clientes)

**Por quê:** hoje um e-mail de cliente não aparece em lugar nenhum do Hub — o dono lembra de registrar manualmente (ou não lembra).

**[HUMANO]:**
1. No mesmo projeto Google Cloud já usado pra Calendar (fase 3), adicionar o escopo `https://www.googleapis.com/auth/gmail.readonly` na tela de consentimento OAuth.
2. **Decisão a tomar antes de implementar**: `gmail.readonly` é escopo "restrito" do Google — um app não verificado publicado como "Testing" funciona só com usuários de teste cadastrados manualmente (o dono, o único usuário, cadastra o próprio e-mail) e pode ter o refresh token expirando a cada 7 dias até o app ser verificado (processo do Google que leva semanas e pede vídeo de demonstração). Registrar em `docs/decisoes.md` se o dono aceita reconectar a cada 7 dias, ou se vale iniciar a verificação do Google. Conferir se a Fase 3 (Calendar) já passou por isso — se sim, mesma decisão vale aqui.

**Implementação:**
- Reaproveitar `src/lib/google/oauth.ts`/`pkce.ts`/`state-cookie.ts`/`client.ts` (fase 3) — só estender `GOOGLE_SCOPES` e criar `src/lib/google/gmail.ts` com as chamadas específicas (`users.messages.list`/`users.messages.get`).
- Job novo `sync_gmail` (periódico, ex. a cada 30 min, mesmo padrão de `calendar_sync`): busca mensagens novas (usar `historyId` da Gmail API pra sincronização incremental, evitando reler tudo a cada vez), filtra pelo remetente batendo com `contacts.email` (já indexado, `contacts_email_idx`) — mensagens de remetente desconhecido são ignoradas (não vira lixo no sistema).
- Nova tabela `email_messages`:
  ```sql
  create table public.email_messages (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    contact_id uuid references public.contacts(id) on delete set null,
    gmail_message_id text not null,
    gmail_thread_id text not null,
    subject text not null default '',
    snippet text not null default '',
    received_at timestamptz not null,
    has_attachments boolean not null default false,
    linked_item_id uuid references public.items(id) on delete set null,   -- se o dono decidir "virar item" (nota/tarefa a partir do e-mail)
    created_at timestamptz not null default now(),
    unique (owner_id, gmail_message_id)
  );
  create index email_messages_contact_idx on public.email_messages (contact_id, received_at desc);
  ```
  Corpo completo do e-mail **não** é guardado por padrão (só assunto + trecho) — evita duplicar uma caixa de entrada inteira; o dono abre no Gmail de verdade quando precisar do corpo completo. Revisitar se isso incomodar na prática.
- Painel do contato (`/contatos/[id]`) ganha uma seção "E-mails recentes" listando `email_messages` daquele contato, com ação "Criar nota a partir deste e-mail" (mesmo padrão de "Criar nota a partir do documento" da fase 2.9).
- Painel da Oportunidade (pack CRM) ganha a mesma seção, casando pelo(s) contato(s) já vinculado(s) à oportunidade.

## 8.4 Leitura automática de notas fiscais e boletos recebidos por e-mail

**Por quê:** hoje o dono precisa baixar o PDF do boleto e subir manualmente pro Hub pra extração funcionar (`extractBillDataFromAttachment`, fase 4). Com a leitura de e-mail da 8.3 já rodando, dá pra fechar o último passo manual.

- No job `sync_gmail` (8.3), quando uma mensagem tem anexo (`has_attachments`) de um contato marcado como `relationship = 'supplier'` ou de domínio conhecido (heurística simples, configurável), baixar o anexo, salvar como `attachments` avulso (sem `item_id`, mesmo padrão de boleto anexado à mão) e reaproveitar `extractBillDataFromAttachment` (`src/features/financas/actions.ts`) pra pré-preencher os campos.
- **Nunca criar a conta a pagar sozinho** — mesmo princípio de toda automação de IA no projeto (CLAUDE.md: nada financeiro é automático sem confirmação): o resultado vira um rascunho em uma lista nova "Boletos por confirmar" (`/financas/contas`, filtro por um status `pending_review` novo, ou reaproveitar o fluxo de "Extrair dados do boleto" que já pede confirmação na tela — decidir na implementação qual dos dois já resolve sem duplicar UI).
- Aviso ao dono (`notifyOwner`) quando um boleto novo for detectado, com link direto pra tela de confirmação.

## 8.5 OAuth 2.1 no servidor MCP

**Por quê:** hoje `/api/mcp` autentica só por bearer token estático (`api_tokens`, escopos `mcp:read`/`mcp:write`/`finance:read`) — já registrado como pendência desde a Fase 6 (`docs/fase-06-relatorios-ia-mcp.md`: "6.9b: OAuth 2.1 para MCP"). Alguns clientes MCP mais novos exigem o fluxo OAuth 2.1 completo (Authorization Code + PKCE) em vez de um token colado manualmente.

- Implementar um Authorization Server mínimo (`/api/mcp/authorize`, `/api/mcp/token`) seguindo a especificação MCP de autorização (baseada em OAuth 2.1 + PKCE + Dynamic Client Registration opcional) — conferir a versão atual da especificação MCP antes de implementar, ela muda entre versões.
- **Manter o bearer token estático funcionando em paralelo** — clientes que já funcionam hoje (Claude Code, Claude Desktop com token colado) não devem quebrar; o fluxo OAuth é uma segunda porta de entrada pro mesmo `/api/mcp`, não substitui a primeira.
- Tokens emitidos pelo fluxo OAuth reaproveitam a tabela `api_tokens` (mesmos escopos, `token_hash`) — só o jeito de emitir/renovar muda (código de autorização + refresh token em vez de gerar na tela de Configurações).
- Página de consentimento simples (`/mcp/authorize`, autenticada com login normal do dono — lembrar que só existe um usuário) confirmando escopos antes de emitir o código.
- **Avaliar se vale a pena antes de implementar**: se nenhum conector real do dono exigir isso ainda, considerar adiar — registrar a decisão em `docs/decisoes.md` em vez de construir um Authorization Server OAuth inteiro sem um cliente de verdade pra testar contra.

## 8.6 Testes da fase

- Portal do cliente: item pai com 2+ filhos, token com `permission: 'view'` mostra os filhos, token revogado/expirado não mostra nada.
- Assinatura de proposta: fluxo completo (criar proposta → gerar link `sign` → assinar → status vira `aceita` → `proposal_signatures` tem a linha) e o caso de token já usado/revogado não deixando assinar de novo.
- `sync_gmail`: mensagem de contato conhecido vira `email_messages`; mensagem de remetente desconhecido é ignorada; re-rodar o job não duplica (unique `gmail_message_id`).
- Extração de boleto por e-mail: mesma bateria de fixtures de PDF/imagem de boleto já usada na 4.x, agora partindo de um anexo de e-mail simulado.
- OAuth do MCP (se implementado nesta fase): fluxo completo de autorização com PKCE, token emitido funciona nas mesmas chamadas que o bearer estático já testado na fase 6.

---

## Definição de pronto da fase

- [ ] Link de portal do cliente mostra vários itens de um projeto só
- [ ] Proposta pode ser assinada eletronicamente pelo cliente, sem o dono confirmar manualmente
- [ ] E-mails de contatos conhecidos aparecem automaticamente ligados ao contato/oportunidade
- [ ] Boleto recebido por e-mail vira rascunho de conta a pagar sem digitação manual
- [ ] (Se implementado) MCP aceita OAuth 2.1 sem quebrar o bearer token existente
- [ ] `PROGRESSO.md` atualizado

---

## Depois da Fase 8: ideias para o futuro

- App offline-first com sincronização local (adiado desde a Fase 7 — maior mudança de arquitetura, decidir com base no uso real).
- Envio de e-mail pelo próprio Hub (hoje só leitura, na 8.3) — responder um cliente sem sair do sistema.
- Notas fiscais de venda emitidas pelo próprio Hub (hoje só leitura de recebidos, na 8.4).
