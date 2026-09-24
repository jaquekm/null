"use server";

import { requireOwner } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";

/** Botão "Exportar tudo" (7.4, `/configuracoes/dados`) — enfileira `export_all` e volta na hora; o zip e o link de download chegam por push quando o job terminar. */
export async function exportAllNow(): Promise<Result<null>> {
  const { user } = await requireOwner();
  try {
    await enqueueJob({ ownerId: user.id, kind: "export_all", dedupeKey: "export_all" });
    return ok(null);
  } catch {
    return fail("Não foi possível iniciar o export.");
  }
}
