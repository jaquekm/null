import "server-only";
import { randomUUID } from "node:crypto";
import { getMessageChannel } from ".";

/**
 * Push direto pro dono (3.9), fora do fluxo de lembretes — usado pelos
 * avisos "configuráveis" (reconexão do Google, falha de job...). Melhor
 * esforço: sem canal push configurado, ou se o envio falhar (nenhum
 * dispositivo ativo, etc.), não lança — quem chama nunca deve quebrar por
 * causa de uma notificação que não é o trabalho principal dele.
 */
export async function notifyOwner(ownerId: string, input: { title: string; text: string }): Promise<void> {
  const channel = getMessageChannel("push");
  if (!channel) return;

  try {
    await channel.send({ deliveryId: randomUUID(), to: ownerId, text: input.text, subject: input.title });
  } catch {
    // melhor esforço — ver comentário acima
  }
}
