# Rotação de segredos e revisão periódica (fase 7.7)

Passo a passo pra rotacionar cada segredo do Hub a cada 6–12 meses (ou
imediatamente, se algum vazar) e o checklist trimestral de revisão de
acessos.

## `CRON_SECRET`

Usado por `/api/jobs/tick`, `/api/health?deep=1` e (junto com outros) pelos
workflows agendados do GitHub Actions que chamam essas rotas.

1. Gere um valor novo: `openssl rand -base64 48`.
2. Atualize `CRON_SECRET` na Vercel (Project Settings → Environment Variables)
   e em qualquer workflow do GitHub Actions que o use.
3. Redeploy. Não precisa de janela de manutenção — a rota só é chamada por
   cron, uma falha isolada de autenticação num tick não perde nada (o
   próximo tick de novo tenta).

## `N8N_WEBHOOK_SECRET`

Assina o `POST` de envio pro N8N e a verificação do callback em
`/api/webhooks/messaging` (3.9).

1. Gere um valor novo.
2. Atualize `N8N_WEBHOOK_SECRET` na Vercel **e** no workflow do N8N
   (`docs/n8n-whatsapp.md`) — os dois lados precisam trocar junto, senão a
   assinatura do lado antigo para de bater.
3. Prefira trocar num horário de baixo volume de mensagens — mensagens que
   chegarem no meio da troca (assinadas com o segredo antigo) serão
   rejeitadas até o N8N também atualizar.

## Tokens de API / MCP

Diferente dos segredos acima, tokens (`/configuracoes/tokens`) não têm um
"valor único pra trocar" — são muitos, um por integração/cliente MCP.

1. Revise a lista em `/configuracoes/tokens` a cada rotação.
2. Para cada token com mais de 6–12 meses: crie um novo com o mesmo escopo,
   atualize o cliente que o usa (Claude Code, automação, etc.), depois
   revogue o antigo.
3. Tokens de escopo MCP já são obrigados a ter validade (máx. 90 dias,
   `createTokenSchema`) e já avisam sozinhos 7 dias antes de expirar
   (`check_mcp_token_expiry`, 6.9) — não precisam de rotação manual
   proativa, só renovar quando avisar.

## `ENCRYPTION_KEY` (a mais delicada — tem dado real por trás)

Criptografa os tokens OAuth do Google (`google_connections`). Rotação **sem
downtime**, em duas etapas:

1. Gere uma chave nova: `openssl rand -base64 32`.
2. Na Vercel: copie o valor **atual** de `ENCRYPTION_KEY` pra
   `ENCRYPTION_KEY_PREVIOUS`, e só depois troque `ENCRYPTION_KEY` pelo valor
   novo. Redeploy.
   - A partir daqui, `encrypt()` (tudo que for gravado de novo) já usa a
     chave nova; `decrypt()` primeiro tenta a chave nova e, se falhar, tenta
     a `ENCRYPTION_KEY_PREVIOUS` — nada para de funcionar durante a troca.
3. Vá em `/configuracoes/segurança` e clique em **"Recriptografar
   segredos"** — enfileira o job `reencrypt_secrets`, que reescreve as
   conexões do Google ainda criptografadas com a chave antiga usando a
   chave nova. Rode de novo se `/configuracoes/jobs` mostrar mais de uma
   conexão do Google (o job é idempotente — rodar sem nada pendente não faz
   nada).
4. Confirme que não sobrou nada na chave antiga antes do próximo passo —
   sem um contador direto na tela, o sinal é o job devolver
   `reencrypted: 0` numa segunda execução.
5. Só depois de confirmar isso, remova `ENCRYPTION_KEY_PREVIOUS` da Vercel e
   redeploy de novo — a partir daqui, um dado ainda preso na chave antiga
   (se sobrou algum, por exemplo por um erro no passo 3) ficaria
   ilegível, então não pule a confirmação do passo 4.

## `BACKUP_REPORT_SECRET`, chaves S3 do bucket de backup, chave `age`

Ver `docs/PROGRESSO.md` (fases 7.1–7.3) pra lista completa — a rotação
segue o mesmo princípio dos outros segredos "por fora" (workflow do GitHub
Actions): gerar novo, atualizar o secret do repositório, rodar o workflow
manualmente uma vez pra confirmar antes de confiar no agendamento.

## Revisão trimestral (checklist)

Repita a cada ~3 meses:

- [ ] `/configuracoes/compartilhamentos`: links públicos ativos — revogar
      qualquer um que não faça mais sentido; para os que ficam, confirmar
      que têm `expires_at` (o `ops_daily_check`, 7.6, já avisa sobre links
      antigos sem validade, mas vale conferir a lista inteira de vez em
      quando).
- [ ] `/configuracoes/tokens`: tokens de API/MCP ativos — revogar os que
      não são mais usados; conferir escopos (nenhum token deveria ter mais
      escopo do que precisa).
- [ ] `/configuracoes/integracoes`: conexão do Google ainda `active`? Se
      revogada há muito tempo sem reconectar, considerar remover.
- [ ] Rodar `pnpm security:check` e o Security Advisor do Supabase
      (dashboard → Advisors → Security) — corrigir qualquer aviso novo.
- [ ] Conferir se alguma dependência do Dependabot ficou parada (PR aberto
      há muito tempo sem revisão).
