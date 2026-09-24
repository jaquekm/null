import { describe, expect, it } from "vitest";
import { getBackupStatus } from "./queries";

interface Row {
  status: string;
  created_at: string;
  size_bytes: number | null;
}

function fakeSupabase(rowsByKind: Partial<Record<string, Row>>) {
  return {
    from: () => ({
      select: () => ({
        eq: (_col: string, kind: string) => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: rowsByKind[kind] ?? null, error: null }),
            }),
          }),
        }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

describe("getBackupStatus", () => {
  it("sem nenhum backup registrado: os dois alertas ficam ligados", async () => {
    const status = await getBackupStatus(fakeSupabase({}));
    expect(status.database).toBeNull();
    expect(status.restoreTest).toBeNull();
    expect(status.databaseStale).toBe(true);
    expect(status.restoreTestStale).toBe(true);
  });

  it("backup de banco bem-sucedido há 10h: não está desatualizado", async () => {
    const status = await getBackupStatus(
      fakeSupabase({ database: { status: "success", created_at: hoursAgo(10), size_bytes: 1000 } }),
    );
    expect(status.databaseStale).toBe(false);
  });

  it("backup de banco bem-sucedido há 60h (> 48h): está desatualizado", async () => {
    const status = await getBackupStatus(
      fakeSupabase({ database: { status: "success", created_at: hoursAgo(60), size_bytes: 1000 } }),
    );
    expect(status.databaseStale).toBe(true);
  });

  it("último backup de banco falhou, mesmo que recente: conta como desatualizado", async () => {
    const status = await getBackupStatus(
      fakeSupabase({ database: { status: "failed", created_at: hoursAgo(1), size_bytes: null } }),
    );
    expect(status.databaseStale).toBe(true);
  });

  it("teste de restauração bem-sucedido há 30 dias (< 45): não está desatualizado", async () => {
    const status = await getBackupStatus(
      fakeSupabase({ restore_test: { status: "success", created_at: daysAgo(30), size_bytes: null } }),
    );
    expect(status.restoreTestStale).toBe(false);
  });

  it("teste de restauração bem-sucedido há 50 dias (> 45): está desatualizado", async () => {
    const status = await getBackupStatus(
      fakeSupabase({ restore_test: { status: "success", created_at: daysAgo(50), size_bytes: null } }),
    );
    expect(status.restoreTestStale).toBe(true);
  });
});
