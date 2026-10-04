/**
 * "Por que meus avisos não chegam?" (pedido da dona, 03/10): lembretes,
 * contas e automações dependem de três coisas que ficam fora da tela — o
 * agendador do Supabase rodando, o aparelho inscrito pra notificação e, pra
 * WhatsApp, o número + o fluxo do N8N. Cada item diz o que está faltando e
 * como resolver, em vez de o aviso simplesmente não chegar.
 */
export interface DeliveryCheck {
  key: "scheduler" | "push" | "whatsapp";
  ok: boolean;
  title: string;
  /** O que fazer (só quando não está ok). */
  fix: string | null;
}

export interface DeliveryInput {
  /** Último minuto em que o agendador chamou o app (`ops_heartbeat`). */
  lastTickAt: string | null;
  now: Date;
  pushDevices: number;
  ownerWhatsapp: string | null;
  whatsappChannelReady: boolean;
}

const TICK_STALE_MINUTES = 10;

function minutesSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 60_000;
}

export function deliveryChecklist(input: DeliveryInput): DeliveryCheck[] {
  const schedulerOk = input.lastTickAt !== null && minutesSince(input.lastTickAt, input.now) <= TICK_STALE_MINUTES;
  const scheduler: DeliveryCheck = {
    key: "scheduler",
    ok: schedulerOk,
    title: schedulerOk ? "Agendador ligado — lembretes saem na hora marcada" : "Agendador desligado — nenhum lembrete agendado sai",
    fix: schedulerOk
      ? null
      : input.lastTickAt
        ? "O agendador parou de chamar o app. Confira no Supabase → Integrations → Vault se os segredos “app_url” e “cron_secret” continuam lá e com o valor certo."
        : "No painel do Supabase, abra Integrations → Vault → “Add new secret” e crie dois: “app_url” com https://null.prescrittomed.com.br e “cron_secret” com o mesmo valor da variável CRON_SECRET da Vercel (copie de lá direto pro Supabase — não mande em chat). Em até 1 minuto este item fica verde.",
  };

  const push: DeliveryCheck = {
    key: "push",
    ok: input.pushDevices > 0,
    title:
      input.pushDevices > 0
        ? `Notificação ligada em ${input.pushDevices} ${input.pushDevices === 1 ? "aparelho" : "aparelhos"}`
        : "Nenhum aparelho recebe notificação",
    fix:
      input.pushDevices > 0
        ? null
        : "Em Configurações → Notificações, toque em “Ativar neste aparelho” e aceite a permissão. No iPhone, antes instale o JKode na tela inicial (Compartilhar → Adicionar à Tela de Início) e abra por lá.",
  };

  const whatsappOk = input.ownerWhatsapp !== null && input.whatsappChannelReady;
  const whatsapp: DeliveryCheck = {
    key: "whatsapp",
    ok: whatsappOk,
    title: whatsappOk ? "WhatsApp pronto pra te avisar" : "WhatsApp ainda não envia (lembretes nesse canal ficam parados)",
    fix: whatsappOk
      ? null
      : input.ownerWhatsapp === null
        ? "Cadastre seu número em Configurações → Notificações → “Seu WhatsApp”. Enquanto isso, escolha “Notificação” como canal dos lembretes."
        : "O envio por WhatsApp depende do fluxo do N8N ligado no servidor (docs/n8n-whatsapp.md). Enquanto isso, escolha “Notificação” como canal dos lembretes.",
  };

  return [scheduler, push, whatsapp];
}
