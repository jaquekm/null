# Configuração das integrações externas

Passo a passo pra cada conta/serviço que o Hub usa. Cada seção termina com quais variáveis
cadastrar na Vercel (Project → Settings → Environment Variables, ambiente **Production** — e
redeploy depois de salvar, senão o app continua rodando com as variáveis antigas).

Onde estiver escrito `.env.local`, é só pra rodar `pnpm dev` na sua máquina — a Vercel nunca lê
esse arquivo (ele nem deveria ir pro Git).

---

## 1. Agendamento automático (pg_cron) — faça isto primeiro

Sem isso, nada do resto funciona sozinho (lembretes, sincronização, limpeza) — só reage a cliques
na tela. Ver seção própria já enviada na conversa (2 comandos no SQL Editor do Supabase + aplicar
a migration `20261005000000_pg_cron_tick.sql`).

---

## 2. Google Calendar

**No Google Cloud Console (https://console.cloud.google.com):**

1. Crie um projeto novo (ou use um que já tenha) — canto superior, "Select a project" → "New Project".
2. No menu ☰ → **APIs & Services** → **Library**. Busque "Google Calendar API" → **Enable**.
3. **APIs & Services** → **OAuth consent screen**:
   - User Type: **External**.
   - Preencha nome do app (ex. "Hub"), e-mail de suporte e o seu próprio e-mail nos dois campos pedidos.
   - Em "Scopes", não precisa adicionar nada aqui (o app pede na hora certa) — pode pular.
   - Em "Test users", **adicione o seu próprio e-mail do Google** (o mesmo que você vai conectar no Hub). Sem isso, o Google recusa a conexão.
   - Salve. O app fica com status "Testing" — funciona, mas com uma ressalva importante (ver aviso abaixo).
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**:
   - Application type: **Web application**.
   - Em "Authorized redirect URIs", adicione exatamente:
     ```
     https://SUA-URL-REAL-DO-APP/api/google/callback
     ```
     (troque pela URL real — a mesma que você vai usar como `APP_URL`). Se testar local também, adicione outra linha `http://localhost:3000/api/google/callback`.
   - Crie. A tela mostra um **Client ID** e um **Client Secret** — copie os dois.

**Cadastre na Vercel:**
```
GOOGLE_CLIENT_ID=<o Client ID copiado>
GOOGLE_CLIENT_SECRET=<o Client Secret copiado>
```

**⚠️ Importante — status "Testing":** enquanto o app não passa pela verificação do Google (processo
de semanas, só necessário se quiser publicar pra outras pessoas — não é o seu caso, é só você
mesmo), o `refresh_token` expira a cada ~7 dias. Na prática: depois de uma semana sem usar, a tela
**Configurações → Integrações** do Hub vai avisar que a conexão caiu, e você clica em "Reconectar" —
leva 10 segundos. Não precisa fazer nada disso agora, só saber que vai acontecer.

**Depois de configurado, no próprio Hub:** entre em **Configurações → Integrações** e clique em
"Conectar com o Google" — você será redirecionado pro Google, loga com a conta de teste que
cadastrou, aceita as permissões de Calendar, e volta pro Hub já conectado.

---

## 3. Transcrição de áudio (AssemblyAI)

1. Crie uma conta em **https://www.assemblyai.com** (tem plano gratuito com créditos pra testar).
2. No painel, vá em **API Keys** (ou "Dashboard" já mostra a chave padrão) e copie sua **API Key**.
3. Gere um valor aleatório qualquer pra ser o segredo do webhook (ex. `openssl rand -base64 32` no terminal, ou qualquer string longa de 32+ caracteres).

**Cadastre na Vercel:**
```
TRANSCRIPTION_PROVIDER=assemblyai
TRANSCRIPTION_API_KEY=<a API Key copiada>
TRANSCRIPTION_WEBHOOK_SECRET=<o valor aleatório gerado>
```

Não precisa configurar nada do lado da AssemblyAI além da conta/chave — o Hub manda o
`webhook_url` (apontando pra `/api/webhooks/transcription`) junto de cada pedido de transcrição,
não é algo que se cadastra uma vez no painel deles.

**Teste:** grave um áudio curto no Hub (ou envie um arquivo de áudio) e confira se a transcrição
aparece depois de alguns segundos/minutos.

---

## 4. E-mail (Resend)

1. Crie uma conta em **https://resend.com**.
2. **Domains** → **Add Domain** → coloque o seu domínio (ex. `seudominio.com.br`).
3. O Resend mostra 2-3 registros DNS (geralmente `TXT`/`MX`/`CNAME`) — cadastre esses registros no
   painel do seu provedor de domínio (Registro.br, GoDaddy, Cloudflare, etc.). Isso prova que você é
   dono do domínio e permite enviar e-mail em nome dele.
4. Espere o Resend confirmar o domínio como "Verified" (pode levar de minutos a algumas horas,
   dependendo da propagação DNS).
5. **API Keys** → **Create API Key** → copie o valor (só aparece uma vez).

**Cadastre na Vercel:**
```
RESEND_API_KEY=<a chave copiada>
EMAIL_FROM=Hub <avisos@seudominio.com.br>
```
(o endereço depois de `avisos@` precisa ser do domínio que você acabou de verificar).

**Se não tiver domínio próprio ainda:** o Resend também permite testar com um domínio deles
(`onboarding@resend.dev`) sem verificação — funciona só pra testar, não é confiável pra uso real
(cai fácil em spam), mas serve pra confirmar que o código funciona antes de configurar seu domínio.

---

## 5. Notificação push no navegador (VAPID)

Não precisa de conta em lugar nenhum — é só gerar um par de chaves. No seu terminal (com Node
instalado):

```bash
npx web-push generate-vapid-keys
```

Isso imprime uma chave pública e uma privada.

**Cadastre na Vercel:**
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<a chave pública>
VAPID_PRIVATE_KEY=<a chave privada>
VAPID_SUBJECT=mailto:seu-email@algum-dominio.com
```
(`VAPID_SUBJECT` pode ser seu e-mail pessoal mesmo — é só um contato de identificação exigido pelo
padrão Web Push, os navegadores nunca mandam nada pra lá.)

**Teste:** em **Configurações → Notificações**, ative "Ativar notificações push neste dispositivo" —
o navegador vai pedir permissão.

---

## 6. IA (Claude/Anthropic) e busca semântica (Voyage AI)

### Anthropic (obrigatório pra qualquer recurso de IA do Hub)

1. Crie uma conta em **https://console.anthropic.com**.
2. **Settings → Billing** → adicione um método de pagamento e carregue algum crédito (uso é
   cobrado por token, bem barato pro volume de uso pessoal — o Hub já tem um teto configurável
   pra evitar surpresa, ver `AI_MONTHLY_BUDGET_USD` abaixo).
3. **API Keys** → **Create Key** → copie o valor.

**Cadastre na Vercel:**
```
ANTHROPIC_API_KEY=<a chave copiada>
ANTHROPIC_MODEL=claude-sonnet-5
AI_MONTHLY_BUDGET_USD=20
```
(`ANTHROPIC_MODEL`: confira em https://docs.anthropic.com/en/docs/about-claude/models qual é o
modelo atual recomendado — pode já estar desatualizado quando você ler isto. `AI_MONTHLY_BUDGET_USD`
é o teto mensal em dólares que o Hub para de gastar sozinho — ajuste ao seu gosto, `20` é só um
ponto de partida.)

### Voyage AI (só se for usar busca semântica/"Pergunte à sua base")

1. Crie uma conta em **https://www.voyageai.com**.
2. Gere uma API key no painel deles.

**Cadastre na Vercel:**
```
EMBEDDINGS_PROVIDER=voyage
EMBEDDINGS_API_KEY=<a chave copiada>
EMBEDDINGS_MODEL=voyage-3
EMBEDDINGS_DIM=1024
```
(`EMBEDDINGS_DIM` não pode ser trocado sem uma migration nova — o banco já foi criado esperando
1024 dimensões.)

---

## 7. WhatsApp

Já documentado em detalhe em `docs/n8n-whatsapp.md` — é o mais trabalhoso de configurar (precisa
de um fluxo N8N próprio ligado à API oficial do WhatsApp), então tem um guia dedicado. Comece por
ali quando for a vez desse.

---

## Depois de configurar tudo

1. Redeploy na Vercel (qualquer variável nova só vale depois de um novo deploy).
2. Rode `pnpm security:check` — ele confere se algum segredo vazou pro bundle do navegador por
   engano (ver `docs/rotacao-segredos.md`).
3. Teste cada integração uma vez de ponta a ponta antes de confiar nela no dia a dia.
