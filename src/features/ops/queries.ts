import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Resolve o `owner_id` do único dono do Hub (CLAUDE.md: "sistema pessoal...
 * com um único usuário") a partir de `user_settings` — usada por rotas que
 * rodam fora de sessão e sem nenhum outro jeito de saber de quem é o dado
 * (ex.: `/api/ops/backup-report`, chamada pelo workflow do GitHub Actions,
 * que não tem `owner_id` nenhum pra mandar). `user_settings.owner_id` é
 * chave primária — sempre no máximo uma linha por dono, e neste app só
 * existe um dono de verdade.
 */
export async function getSoleOwnerId(admin: Client): Promise<string | null> {
  const { data } = await admin.from("user_settings").select("owner_id").limit(1).maybeSingle();
  return data?.owner_id ?? null;
}

export interface BackupRunInput {
  ownerId: string;
  kind: "database" | "storage" | "restore_test" | "export";
  status: "success" | "failed";
  sizeBytes?: number | null;
  location?: string | null;
  detail?: string | null;
}

/** Registra um backup/exportação/teste de restauração (7.1/7.2/7.3/7.4). */
export async function recordBackupRun(admin: Client, input: BackupRunInput): Promise<void> {
  await admin.from("backup_runs").insert({
    owner_id: input.ownerId,
    kind: input.kind,
    status: input.status,
    size_bytes: input.sizeBytes ?? null,
    location: input.location ?? null,
    detail: input.detail ?? null,
  });
}
