import { decrypt, encrypt, wasEncryptedWithPreviousKey } from "@/lib/crypto";
import type { JobHandler } from "../types";

/**
 * Job `reencrypt_secrets` (7.7, rotação de `ENCRYPTION_KEY` sem downtime):
 * roda sob demanda depois do dono trocar `ENCRYPTION_KEY` e mover o valor
 * antigo pra `ENCRYPTION_KEY_PREVIOUS` — reescreve com a chave atual só o
 * que ainda está sob a chave anterior. Idempotente: rodar de novo sem
 * nenhum segredo pendente só devolve `reencrypted: 0`, seguro pra tentar
 * até confirmar que zerou (aí sim o dono pode apagar `ENCRYPTION_KEY_PREVIOUS`).
 */
export const reencryptSecrets: JobHandler = async (job, { supabase }) => {
  const { data: connections, error } = await supabase
    .from("google_connections")
    .select("id, access_token_encrypted, refresh_token_encrypted")
    .eq("owner_id", job.owner_id);
  if (error) return { status: "retry", error: error.message };

  let reencrypted = 0;
  for (const connection of connections ?? []) {
    const updates: { access_token_encrypted?: string; refresh_token_encrypted?: string } = {};

    if (connection.access_token_encrypted && wasEncryptedWithPreviousKey(connection.access_token_encrypted)) {
      updates.access_token_encrypted = encrypt(decrypt(connection.access_token_encrypted));
    }
    if (wasEncryptedWithPreviousKey(connection.refresh_token_encrypted)) {
      updates.refresh_token_encrypted = encrypt(decrypt(connection.refresh_token_encrypted));
    }

    if (Object.keys(updates).length === 0) continue;
    const { error: updateError } = await supabase.from("google_connections").update(updates).eq("id", connection.id);
    if (!updateError) reencrypted++;
  }

  return { status: "done", result: { reencrypted } };
};
