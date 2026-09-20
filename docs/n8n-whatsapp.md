# WhatsApp via N8N (fase 3.9)

O Hub não fala com a API do WhatsApp diretamente. Ele manda a mensagem pra um fluxo N8N
que você monta e mantém; esse fluxo é quem chama a API oficial do WhatsApp (Cloud API) ou
outra integração já existente sua, e avisa o Hub de volta quando terminar. Isso mantém as
credenciais da Meta fora do Hub e dá liberdade pra trocar de provedor sem mexer no código.

Duas direções:

1. **Hub → N8N**: pedido de envio (`POST` assinado).
2. **N8N → Hub**: confirmação de entrega, ou aviso de opt-out (`POST` assinado em `/api/webhooks/messaging`).

## Variáveis de ambiente

No Hub (`.env.local`/Vercel):

```
MESSAGING_PROVIDER=n8n
N8N_WHATSAPP_WEBHOOK_URL=https://SEU-N8N/webhook/hub-whatsapp
N8N_WEBHOOK_SECRET=<32+ bytes aleatórios — ex.: openssl rand -base64 32>
```

No N8N: as credenciais da WhatsApp Cloud API (token de acesso, `phone_number_id`) e o **mesmo**
`N8N_WEBHOOK_SECRET`, guardados como credencial/variável do próprio N8N — nunca hardcoded no fluxo.

## 1. Hub → N8N (pedido de envio)

O Hub faz:

```
POST <N8N_WHATSAPP_WEBHOOK_URL>
Content-Type: application/json
X-Hub-Signature: <hex>

{
  "deliveryId": "uuid da linha em reminder_deliveries",
  "to": "+5511999998888",
  "text": "Oi Bia, sua consulta é amanhã às 14h.",
  "template": null
}
```

`template`, quando presente, é `{ "name": "lembrete_generico", "language": "pt_BR", "variables": ["Bia", "amanhã às 14h"] }`
— ver seção "Templates aprovados" abaixo.

`X-Hub-Signature` é HMAC-SHA256 (hexadecimal) do **corpo cru** (os bytes exatos do JSON, antes
de qualquer parse) usando `N8N_WEBHOOK_SECRET` como chave. Em Node.js:

```js
const crypto = require("node:crypto");
const signature = crypto.createHmac("sha256", N8N_WEBHOOK_SECRET).update(rawBody).digest("hex");
```

### Fluxo N8N — "Enviar WhatsApp" (recebe o pedido do Hub)

1. **Webhook** (trigger): método `POST`, path livre (é a URL que vira `N8N_WHATSAPP_WEBHOOK_URL`).
   Configure pra devolver o corpo cru pro próximo nó (não deixar o N8N reformatar o JSON antes
   de validar a assinatura — a validação precisa dos bytes exatos).
2. **Validar assinatura** (nó *Code*): recalcula o HMAC do corpo recebido com o secret guardado
   e compara com o header `X-Hub-Signature` em **tempo constante** (`crypto.timingSafeEqual`, não
   `===`). Assinatura errada → responde `401` e para o fluxo (não chama o WhatsApp).
3. **Enviar pela WhatsApp Cloud API** (nó *HTTP Request*): `POST
   https://graph.facebook.com/v21.0/<phone_number_id>/messages` com o token da Meta, corpo:
   - Se `template` for `null`: mensagem de texto livre (`{"messaging_product":"whatsapp","to":"...","type":"text","text":{"body":"..."}}`)
     — só funciona se o destinatário mandou mensagem pro seu número nas últimas 24h (ver
     "Regras do WhatsApp oficial" abaixo). Fora dessa janela, a Meta rejeita.
   - Se `template` vier preenchido: `{"messaging_product":"whatsapp","to":"...","type":"template","template":{"name":"...","language":{"code":"..."},"components":[{"type":"body","parameters":[...]}]}}`,
     usando `template.name`/`template.language`/`template.variables` do pedido.
4. **Responder ao Hub**: `200` se a Cloud API aceitou (não precisa esperar a entrega final —
   isso vem depois, pelo webhook de status da própria Meta). Qualquer erro nesse passo (Cloud
   API fora do ar, token expirado) → responde um status não-2xx; o Hub trata isso como falha
   imediata (não fica esperando).
5. **Chamar de volta `/api/webhooks/messaging`** (nó *HTTP Request*, pode ser no mesmo fluxo
   ou disparado pelo webhook de status da Meta — ver próxima seção): assinado do mesmo jeito
   (HMAC do corpo com `N8N_WEBHOOK_SECRET`, no header `X-Hub-Signature`), corpo:

   ```json
   { "deliveryId": "<o mesmo recebido no passo 1>", "status": "sent", "providerMessageId": "wamid.XXXX" }
   ```

   `status` aceito: `"sent"`, `"delivered"`, `"read"` ou `"failed"` (com `"error": "..."` nesse
   caso). Pode chamar mais de uma vez pro mesmo `deliveryId` conforme a Meta for confirmando
   `sent` → `delivered` → `read` (o Hub sempre grava o status mais recente).

## 2. N8N → Hub (confirmações e opt-out)

### Fluxo N8N — "Webhook de status da Meta"

A própria WhatsApp Cloud API manda webhooks de status (`sent`/`delivered`/`read`/`failed`) e de
mensagens recebidas pro número. Configure um segundo fluxo N8N:

1. **Webhook** (trigger) recebendo os callbacks da Meta (siga a documentação da Cloud API pra
   verificação inicial do endpoint — challenge/`hub.verify_token`, não confundir com o
   `X-Hub-Signature` do Hub).
2. **Roteamento por tipo de evento**:
   - **Status de mensagem enviada** (`statuses[]` no payload da Meta): mapeia o `wamid` de volta
     pro `deliveryId` (guarde essa relação no passo 5 do fluxo anterior, ex.: num nó de dados/
     banco do próprio N8N, ou reaproveitando o corpo já assinado ali) e chama `POST
     /api/webhooks/messaging` com `{deliveryId, status, providerMessageId}` (assinado).
   - **Mensagem recebida** (`messages[]` no payload da Meta): se o texto (maiúsculo/minúsculo,
     sem acento) for `"SAIR"`, `"PARAR"` ou `"STOP"`, chama `POST /api/webhooks/messaging` com:

     ```json
     { "type": "opt_out", "phone": "+5511999998888" }
     ```

     (assinado, mesmo `X-Hub-Signature`). O Hub marca `contacts.opted_out_at` e desliga
     `whatsapp_opt_in`/`email_opt_in` desse contato — nenhum lembrete mais é enviado a ele por
     nenhum canal até o dono reativar manualmente o opt-in.

## Templates aprovados

Mensagens que a **empresa inicia** (não uma resposta dentro de 24h de uma mensagem do
contato) exigem um **template aprovado pela Meta**. Crie pelo menos:

- `lembrete_generico`: corpo com 2 variáveis, ex. `"Olá {{1}}, lembrete: {{2}}."` — mapeado no
  Hub como `template: { name: "lembrete_generico", language: "pt_BR", variables: [nome, texto] }`.

Cadastre o template no WhatsApp Manager (Meta Business), aguarde aprovação, e ajuste o nome/
variáveis no fluxo N8N (passo 3 acima) pra bater com o que foi aprovado. Sem isso, qualquer
lembrete fora da janela de 24h falha na Cloud API.

## Regras do WhatsApp oficial (resumo)

- **Janela de 24h**: só dá pra mandar mensagem de texto livre até 24h depois da última
  mensagem que o contato mandou pro seu número. Fora disso, só template aprovado.
- **Cobrança**: a Meta cobra por conversa/mensagem (varia por país/categoria). Acompanhe no
  WhatsApp Manager.
- **Não use bibliotecas não oficiais de WhatsApp Web** (ex.: automação via navegador/QR code)
  pra isso — risco real de banimento do número. Use sempre a Cloud API oficial (ou outra
  integração oficial que você já tenha).

## Checklist pro dono

- [ ] Criar app Meta Business + número de WhatsApp Business (Cloud API).
- [ ] Criar e aprovar o template `lembrete_generico` (ou o nome que escolher — ajustar no fluxo).
- [ ] Montar os dois fluxos N8N descritos acima.
- [ ] Gerar `N8N_WEBHOOK_SECRET` (`openssl rand -base64 32`) e configurar nos dois lados (Hub e N8N).
- [ ] Configurar `N8N_WHATSAPP_WEBHOOK_URL` apontando pro primeiro fluxo.
- [ ] Testar: criar um lembrete de teste em `/lembretes`, "Enviar agora", conferir que chega no
      WhatsApp e que o status muda pra "Enviado" em `/lembretes` (aba Enviados).
- [ ] Testar opt-out: mandar "PARAR" do número de teste, conferir que `opted_out_at` foi gravado
      no contato.
