import { removeItemAttachmentsFromStorage } from "@/features/attachments/actions";
import type { JobHandler } from "../types";

const TRASH_RETENTION_DAYS = 30;

/**
 * Job periódico (2.2, diário via `job_schedules`): exclui definitivamente
 * itens na lixeira há mais de 30 dias, removendo os anexos do Storage antes
 * (o `on delete cascade` de `attachments` só limpa a linha do banco).
 */
export const purgeTrash: JobHandler = async (job, { supabase }) => {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: items, error } = await supabase
    .from("items")
    .select("id")
    .eq("owner_id", job.owner_id)
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (error) return { status: "retry", error: error.message };
  if (items.length === 0) return { status: "done", result: { purged: 0 } };

  for (const item of items) {
    await removeItemAttachmentsFromStorage(supabase, item.id);
  }

  const { error: deleteError } = await supabase
    .from("items")
    .delete()
    .eq("owner_id", job.owner_id)
    .in(
      "id",
      items.map((item) => item.id),
    );
  if (deleteError) return { status: "retry", error: deleteError.message };

  return { status: "done", result: { purged: items.length } };
};
