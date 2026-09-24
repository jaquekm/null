import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ serverEnv: { CRON_SECRET: "cron-secret" } }));

const getSoleOwnerId = vi.fn();
const checkDatabaseConnectivity = vi.fn();
const getLastTickAt = vi.fn();
const countFailedJobsSince = vi.fn();
const getBackupStatus = vi.fn();
const hasRevokedGoogleConnection = vi.fn();
vi.mock("@/features/ops/queries", () => ({
  getSoleOwnerId: (...args: unknown[]) => getSoleOwnerId(...args),
  checkDatabaseConnectivity: (...args: unknown[]) => checkDatabaseConnectivity(...args),
  getLastTickAt: (...args: unknown[]) => getLastTickAt(...args),
  countFailedJobsSince: (...args: unknown[]) => countFailedJobsSince(...args),
  getBackupStatus: (...args: unknown[]) => getBackupStatus(...args),
  hasRevokedGoogleConnection: (...args: unknown[]) => hasRevokedGoogleConnection(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { GET } = await import("./route");

function request(url: string, authHeader?: string): Request {
  return new Request(url, { headers: authHeader ? { authorization: authHeader } : {} });
}

function mockAllHealthy() {
  getSoleOwnerId.mockResolvedValue("owner-1");
  checkDatabaseConnectivity.mockResolvedValue(true);
  getLastTickAt.mockResolvedValue(new Date().toISOString());
  countFailedJobsSince.mockResolvedValue(0);
  getBackupStatus.mockResolvedValue({ databaseStale: false });
  hasRevokedGoogleConnection.mockResolvedValue(false);
}

beforeEach(() => {
  getSoleOwnerId.mockReset();
  checkDatabaseConnectivity.mockReset();
  getLastTickAt.mockReset();
  countFailedJobsSince.mockReset();
  getBackupStatus.mockReset();
  hasRevokedGoogleConnection.mockReset();
});

describe("GET /api/health (raso, sem ?deep=1)", () => {
  it("responde status ok com hora e versão, sem detalhes internos, sem checar nada", async () => {
    const response = await GET(request("https://hub.example/api/health"));
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(new Date(body.time).toISOString()).toBe(body.time);
    expect(typeof body.version).toBe("string");
    expect(Object.keys(body).sort()).toEqual(["status", "time", "version"]);
    expect(getSoleOwnerId).not.toHaveBeenCalled();
  });
});

describe("GET /api/health?deep=1", () => {
  it("sem Authorization: 401", async () => {
    const response = await GET(request("https://hub.example/api/health?deep=1"));
    expect(response.status).toBe(401);
  });

  it("com segredo errado: 401", async () => {
    const response = await GET(request("https://hub.example/api/health?deep=1", "Bearer errado"));
    expect(response.status).toBe(401);
  });

  it("sem dono configurado ainda: 503", async () => {
    getSoleOwnerId.mockResolvedValue(null);
    const response = await GET(request("https://hub.example/api/health?deep=1", "Bearer cron-secret"));
    expect(response.status).toBe(503);
  });

  it("tudo saudável: 200, status ok, 5 checks", async () => {
    mockAllHealthy();
    const response = await GET(request("https://hub.example/api/health?deep=1", "Bearer cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks).toHaveLength(5);
    expect(body.checks.every((c: { ok: boolean }) => c.ok)).toBe(true);
  });

  it("backup atrasado: 503, status degraded, o check de backup aparece como falho", async () => {
    mockAllHealthy();
    getBackupStatus.mockResolvedValue({ databaseStale: true });

    const response = await GET(request("https://hub.example/api/health?deep=1", "Bearer cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    const backupCheck = body.checks.find((c: { key: string }) => c.key === "backup");
    expect(backupCheck.ok).toBe(false);
  });

  it("jobs falhando nas últimas 24h: degraded", async () => {
    mockAllHealthy();
    countFailedJobsSince.mockResolvedValue(3);

    const response = await GET(request("https://hub.example/api/health?deep=1", "Bearer cron-secret"));
    expect(response.status).toBe(503);
  });
});
