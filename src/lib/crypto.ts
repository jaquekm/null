import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { serverEnv } from "./env";
import { timingSafeEqualStrings } from "./timing-safe-equal";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

function decodeKey(base64Key: string, varName: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`${varName} precisa decodificar pra 32 bytes em base64 (ex.: \`openssl rand -base64 32\`).`);
  }
  return key;
}

/** `ENCRYPTION_KEY` decodificada uma vez por chamada — nunca guardada em módulo (evita ficar em memória além do necessário). */
function getKey(): Buffer {
  return decodeKey(serverEnv.ENCRYPTION_KEY, "ENCRYPTION_KEY");
}

/** `ENCRYPTION_KEY_PREVIOUS` (7.7, rotação sem downtime) — `null` quando não configurada. */
function getPreviousKey(): Buffer | null {
  return serverEnv.ENCRYPTION_KEY_PREVIOUS ? decodeKey(serverEnv.ENCRYPTION_KEY_PREVIOUS, "ENCRYPTION_KEY_PREVIOUS") : null;
}

/**
 * AES-256-GCM (3.2) — usado pelos tokens OAuth de terceiros (Google Calendar,
 * 3.4) e qualquer outro segredo de terceiro guardado no banco (CLAUDE.md:
 * "Tokens OAuth de terceiros são criptografados com AES-256-GCM"). Formato:
 * `base64(iv 12 bytes).base64(authTag 16 bytes).base64(ciphertext)`.
 */
export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

function decryptWithKey(key: Buffer, iv: Buffer, authTag: Buffer, ciphertext: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

/**
 * Lança se o payload estiver em formato inválido ou tiver sido adulterado
 * (GCM falha a autenticação). Tenta `ENCRYPTION_KEY` (atual) primeiro; se
 * falhar e `ENCRYPTION_KEY_PREVIOUS` estiver configurada (7.7, rotação sem
 * downtime), tenta com ela antes de desistir — nunca o contrário, `encrypt()`
 * sempre usa só a chave atual.
 */
export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Payload criptografado em formato inválido.");
  const [ivPart, authTagPart, ciphertextPart] = parts as [string, string, string];

  const iv = Buffer.from(ivPart, "base64");
  const authTag = Buffer.from(authTagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");

  try {
    return decryptWithKey(getKey(), iv, authTag, ciphertext);
  } catch (err) {
    const previousKey = getPreviousKey();
    if (!previousKey) throw err;
    return decryptWithKey(previousKey, iv, authTag, ciphertext);
  }
}

/** `true` quando o payload só decodifica com `ENCRYPTION_KEY_PREVIOUS` — usado pelo job `reencrypt_secrets` (7.7) pra saber o que ainda falta reescrever com a chave atual. */
export function wasEncryptedWithPreviousKey(payload: string): boolean {
  const parts = payload.split(".");
  if (parts.length !== 3) return false;
  const [ivPart, authTagPart, ciphertextPart] = parts as [string, string, string];
  try {
    decryptWithKey(getKey(), Buffer.from(ivPart, "base64"), Buffer.from(authTagPart, "base64"), Buffer.from(ciphertextPart, "base64"));
    return false;
  } catch {
    return getPreviousKey() !== null;
  }
}

/** Hash de conteúdo não-secreto que precisa ser comparável (ex.: `ip_hash` dos acessos a link compartilhado, 3.11). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Mesma comparação em tempo constante já usada pelos webhooks (2.2/2.4) — reexportada aqui com o nome que o enunciado da 3.2 pede, sem duplicar a lógica. */
export { timingSafeEqualStrings as safeEqual };

/** Assinatura HMAC (ex.: `X-Hub-Signature` do webhook do N8N, 3.9). */
export function hmacSha256Hex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
