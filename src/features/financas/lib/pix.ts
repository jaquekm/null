/**
 * Pix copia e cola (BR Code estático, EMV/Bacen) — 4.10. TLV: `ID(2) + tamanho(2) + valor`.
 * Referência: docs/fase-04-financas.md, seção 4.10.
 */

export type PixKeyKind = "cpf" | "cnpj" | "email" | "phone" | "random";

export interface PixPayloadInput {
  key: string;
  merchantName: string;
  merchantCity: string;
  /** Omitido (ou <= 0) = valor livre, quem paga digita. */
  amountCents?: number;
  txid?: string;
  description?: string;
}

const CRC_ID_AND_LENGTH = "6304";

function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Campo Pix ${id} excede 99 caracteres: "${value}".`);
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Maiúsculas, sem acento, cortado no tamanho — usado pra nome/cidade do recebedor (limites do padrão Pix). */
function normalizeMerchantText(value: string, maxLength: number): string {
  return stripAccents(value).toUpperCase().trim().slice(0, maxLength);
}

function normalizeTxid(txid: string | undefined): string {
  const cleaned = (txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  return cleaned || "***";
}

/** Chave telefone precisa ir como `+55DDDNUMERO` (só dígitos + prefixo `+55`, sem espaço/parênteses/traço). */
export function normalizePixPhoneKey(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  return `+${withCountryCode}`;
}

/** Normaliza o valor da chave conforme o tipo antes de montar o payload (CPF/CNPJ só dígitos, telefone `+55...`, e-mail minúsculo). */
export function normalizePixKeyValue(keyType: PixKeyKind, keyValue: string): string {
  const trimmed = keyValue.trim();
  switch (keyType) {
    case "phone":
      return normalizePixPhoneKey(trimmed);
    case "cpf":
    case "cnpj":
      return trimmed.replace(/\D/g, "");
    case "email":
    case "random":
      return trimmed.toLowerCase();
  }
}

/**
 * CRC-16/CCITT-FALSE (poly `0x1021`, init `0xFFFF`, sem reflexão, sem XOR final) —
 * exatamente o que o Bacen exige pro campo 63 do BR Code, calculado sobre a
 * string inteira já incluindo o prefixo literal `6304` (ID+tamanho do próprio CRC).
 */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Monta o BR Code (Pix copia e cola) estático completo, já com o CRC16 final. */
export function buildPixPayload(input: PixPayloadInput): string {
  const key = input.key.trim();
  if (!key) throw new Error("Chave Pix obrigatória.");

  const merchantName = normalizeMerchantText(input.merchantName, 25);
  const merchantCity = normalizeMerchantText(input.merchantCity, 15);
  if (!merchantName) throw new Error("Nome do recebedor obrigatório.");
  if (!merchantCity) throw new Error("Cidade do recebedor obrigatória.");

  const accountInfoParts = [tlv("00", "br.gov.bcb.pix"), tlv("01", key)];
  if (input.description?.trim()) accountInfoParts.push(tlv("02", stripAccents(input.description.trim())));

  const fields = [
    tlv("00", "01"),
    tlv("26", accountInfoParts.join("")),
    tlv("52", "0000"),
    tlv("53", "986"),
    ...(input.amountCents != null && input.amountCents > 0 ? [tlv("54", (input.amountCents / 100).toFixed(2))] : []),
    tlv("58", "BR"),
    tlv("59", merchantName),
    tlv("60", merchantCity),
    tlv("62", tlv("05", normalizeTxid(input.txid))),
  ];

  const payloadWithoutCrc = fields.join("") + CRC_ID_AND_LENGTH;
  return payloadWithoutCrc + crc16ccitt(payloadWithoutCrc);
}
