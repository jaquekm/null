/**
 * Texto que acompanha o link no WhatsApp/e-mail/compartilhar do celular.
 * Diz o que a pessoa vai ver e que não precisa de conta — ela nunca cria
 * conta no JKode, só abre o link.
 */
export function shareMessage(title: string, url: string, isList: boolean): string {
  const name = title.trim() || "Sem título";
  const what = isList ? `a lista “${name}”` : `“${name}”`;
  return `Estou compartilhando ${what} com você. Acompanhe por aqui — o link mostra sempre a versão atual, sem precisar criar conta: ${url}`;
}
