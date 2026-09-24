import { NextResponse } from "next/server";
import { z } from "zod";
import { getSoleOwnerId, recordBackupRun } from "@/features/ops/queries";
import { serverEnv } from "@/lib/env";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqualStrings } from "@/lib/timing-safe-equal";

const KIND_LABELS: Record<string, string> = {
  database: "Backup do banco",
  storage: "Backup de arquivos",
  restore_test: "Teste de restauração",
  export: "Exportação",
};

const backupReportSchema = z.object({
  kind: z.enum(["database", "storage", "restore_test", "export"]),
  status: z.enum(["success", "failed"]),
  sizeBytes: z.number().int().nonnegative().optional(),
  location: z.string().max(500).optional(),
  detail: z.string().max(2000).optional(),
});

/**
 * `POST /api/ops/backup-report` (7.1): chamada pelos workflows do GitHub
 * Actions (`backup.yml`, `storage-backup.yml`, `restore-test.yml`), nunca
 * pelo navegador — sem sessão, autenticado só por `BACKUP_REPORT_SECRET`
 * (mesmo padrão de `Bearer <segredo>` de `/api/jobs/tick`). Sem `owner_id`
 * no payload (o workflow não tem como saber) — resolvido via
 * `getSoleOwnerId` (só existe um dono neste app).
 */
export async function POST(request: Request) {
  if (!serverEnv.BACKUP_REPORT_SECRET) {
    return NextResponse.json({ error: "BACKUP_REPORT_SECRET não configurado." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualStrings(authHeader, `Bearer ${serverEnv.BACKUP_REPORT_SECRET}`)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = backupReportSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const ownerId = await getSoleOwnerId(admin);
  if (!ownerId) {
    return NextResponse.json({ error: "Nenhum dono cadastrado ainda (user_settings vazio)." }, { status: 503 });
  }

  await recordBackupRun(admin, {
    ownerId,
    kind: parsed.data.kind,
    status: parsed.data.status,
    sizeBytes: parsed.data.sizeBytes,
    location: parsed.data.location,
    detail: parsed.data.detail,
  });

  if (parsed.data.status === "failed") {
    await notifyOwner(ownerId, {
      title: `${KIND_LABELS[parsed.data.kind]} falhou`,
      text: parsed.data.detail ?? "Confira o log do workflow no GitHub Actions.",
    });
  }

  return NextResponse.json({ ok: true });
}
