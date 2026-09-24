import { describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import type { Job } from "../types";

const decrypt = vi.fn();
const encrypt = vi.fn();
const wasEncryptedWithPreviousKey = vi.fn();
vi.mock("@/lib/crypto", () => ({
  decrypt: (...args: unknown[]) => decrypt(...args),
  encrypt: (...args: unknown[]) => encrypt(...args),
  wasEncryptedWithPreviousKey: (...args: unknown[]) => wasEncryptedWithPreviousKey(...args),
}));

const { reencryptSecrets } = await import("./reencrypt-secrets");

const OWNER_ID = "owner-1";

function job(): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "reencrypt_secrets",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 0,
    max_attempts: 5,
    run_after: new Date().toISOString(),
    locked_at: new Date().toISOString(),
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Job;
}

describe("reencryptSecrets", () => {
  it("sem nenhuma conexão: done, reencrypted: 0", async () => {
    const fake = new FakeSupabase();
    const outcome = await reencryptSecrets(job(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { reencrypted: 0 } });
  });

  it("reescreve só quem ainda está sob a chave anterior", async () => {
    const fake = new FakeSupabase();
    fake.seed("google_connections", [
      { id: "conn-fresh", owner_id: OWNER_ID, access_token_encrypted: "fresh-access", refresh_token_encrypted: "fresh-refresh" },
      { id: "conn-legacy", owner_id: OWNER_ID, access_token_encrypted: "legacy-access", refresh_token_encrypted: "legacy-refresh" },
    ]);

    wasEncryptedWithPreviousKey.mockImplementation((payload: string) => payload.startsWith("legacy"));
    decrypt.mockImplementation((payload: string) => `plain:${payload}`);
    encrypt.mockImplementation((plain: string) => `reencrypted:${plain}`);

    const outcome = await reencryptSecrets(job(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { reencrypted: 1 } });

    const rows = fake.rowsOf("google_connections");
    const fresh = rows.find((r) => r.id === "conn-fresh")!;
    expect(fresh.access_token_encrypted).toBe("fresh-access");
    expect(fresh.refresh_token_encrypted).toBe("fresh-refresh");

    const legacy = rows.find((r) => r.id === "conn-legacy")!;
    expect(legacy.access_token_encrypted).toBe("reencrypted:plain:legacy-access");
    expect(legacy.refresh_token_encrypted).toBe("reencrypted:plain:legacy-refresh");
  });

  it("access_token_encrypted nulo: só reescreve o refresh_token se precisar", async () => {
    const fake = new FakeSupabase();
    fake.seed("google_connections", [{ id: "conn-1", owner_id: OWNER_ID, access_token_encrypted: null, refresh_token_encrypted: "legacy-refresh" }]);

    wasEncryptedWithPreviousKey.mockImplementation((payload: string) => payload === "legacy-refresh");
    decrypt.mockImplementation((payload: string) => `plain:${payload}`);
    encrypt.mockImplementation((plain: string) => `reencrypted:${plain}`);

    const outcome = await reencryptSecrets(job(), { supabase: fake as never });
    expect(outcome).toEqual({ status: "done", result: { reencrypted: 1 } });
    expect(fake.rowsOf("google_connections")[0]!.refresh_token_encrypted).toBe("reencrypted:plain:legacy-refresh");
  });
});
