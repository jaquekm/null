import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ serverEnv: { BACKUP_REPORT_SECRET: "backup-secret" } }));

const notifyOwnerMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner: notifyOwnerMock }));

interface Config {
  ownerId?: string | null;
}

function fakeSupabase(config: Config) {
  const insertedRuns: Record<string, unknown>[] = [];

  const client = {
    from: (table: string) => {
      if (table === "user_settings") {
        return {
          select: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: config.ownerId ? { owner_id: config.ownerId } : null, error: null }),
            }),
          }),
        };
      }
      if (table === "backup_runs") {
        return {
          insert: (values: Record<string, unknown>) => {
            insertedRuns.push(values);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { client, insertedRuns };
}

let clientForTest: ReturnType<typeof fakeSupabase>["client"] | null = null;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => clientForTest }));

const { POST } = await import("./route");

function fakeRequest(body: unknown, authHeader?: string): Request {
  return new Request("https://hub.example/api/ops/backup-report", {
    method: "POST",
    headers: { ...(authHeader ? { authorization: authHeader } : {}), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ops/backup-report", () => {
  beforeEach(() => {
    notifyOwnerMock.mockClear();
    clientForTest = null;
  });

  it("sem Authorization: 401", async () => {
    const res = await POST(fakeRequest({ kind: "database", status: "success" }));
    expect(res.status).toBe(401);
  });

  it("com segredo errado: 401", async () => {
    const res = await POST(fakeRequest({ kind: "database", status: "success" }, "Bearer errado"));
    expect(res.status).toBe(401);
  });

  it("corpo inválido (kind desconhecido): 400", async () => {
    clientForTest = fakeSupabase({ ownerId: "owner-1" }).client;
    const res = await POST(fakeRequest({ kind: "invalido", status: "success" }, "Bearer backup-secret"));
    expect(res.status).toBe(400);
  });

  it("sem dono cadastrado ainda (user_settings vazio): 503, não grava nada", async () => {
    const { client, insertedRuns } = fakeSupabase({ ownerId: null });
    clientForTest = client;
    const res = await POST(fakeRequest({ kind: "database", status: "success" }, "Bearer backup-secret"));
    expect(res.status).toBe(503);
    expect(insertedRuns).toHaveLength(0);
  });

  it("sucesso: grava em backup_runs e não avisa o dono", async () => {
    const { client, insertedRuns } = fakeSupabase({ ownerId: "owner-1" });
    clientForTest = client;

    const res = await POST(
      fakeRequest({ kind: "database", status: "success", sizeBytes: 1024, location: "db/2026/09/hub-2026-09-24.dump.age" }, "Bearer backup-secret"),
    );

    expect(res.status).toBe(200);
    expect(insertedRuns).toEqual([
      { owner_id: "owner-1", kind: "database", status: "success", size_bytes: 1024, location: "db/2026/09/hub-2026-09-24.dump.age", detail: null },
    ]);
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("falha: grava em backup_runs e avisa o dono por push", async () => {
    const { client, insertedRuns } = fakeSupabase({ ownerId: "owner-1" });
    clientForTest = client;

    const res = await POST(fakeRequest({ kind: "storage", status: "failed", detail: "endpoint S3 fora do ar" }, "Bearer backup-secret"));

    expect(res.status).toBe(200);
    expect(insertedRuns[0]).toMatchObject({ kind: "storage", status: "failed" });
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnerMock).toHaveBeenCalledWith("owner-1", { title: "Backup de arquivos falhou", text: "endpoint S3 fora do ar" });
  });
});
