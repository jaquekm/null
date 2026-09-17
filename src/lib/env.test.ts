import { afterEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV = {
  APP_URL: "http://localhost:3000",
  OWNER_EMAIL: "dono@example.com",
  CRON_SECRET: "segredo-de-teste",
  ENCRYPTION_KEY: "chave-de-teste",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-de-teste",
  NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-de-teste",
};

async function importEnvWith(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) {
    vi.stubEnv(key, value ?? "");
    if (value === undefined) delete process.env[key];
  }
  return import("./env");
}

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("carrega publicEnv e serverEnv quando todas as variáveis obrigatórias existem", async () => {
    const { publicEnv, serverEnv } = await importEnvWith(REQUIRED_ENV);
    expect(publicEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(
      REQUIRED_ENV.NEXT_PUBLIC_SUPABASE_URL,
    );
    expect(serverEnv.OWNER_EMAIL).toBe(REQUIRED_ENV.OWNER_EMAIL);
  });

  it("lança erro claro quando falta uma variável obrigatória do servidor", async () => {
    const { CRON_SECRET, ...rest } = REQUIRED_ENV;
    await expect(importEnvWith(rest)).rejects.toThrow(/CRON_SECRET/);
  });

  it("lança erro claro quando falta uma variável pública obrigatória", async () => {
    const { NEXT_PUBLIC_SUPABASE_URL, ...rest } = REQUIRED_ENV;
    await expect(importEnvWith(rest)).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("rejeita OWNER_EMAIL que não é um e-mail válido", async () => {
    await expect(
      importEnvWith({ ...REQUIRED_ENV, OWNER_EMAIL: "não-é-email" }),
    ).rejects.toThrow(/OWNER_EMAIL/);
  });
});
