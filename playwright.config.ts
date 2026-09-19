import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * E2E (1.18). Precisa de uma conta de teste já onboardada (espaços/tipos
 * padrão criados pela 1.3) e sem MFA, em `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`
 * — ver `.env.example`. Roda contra `pnpm dev` por padrão (webServer abaixo);
 * aponte `E2E_BASE_URL` pra outro ambiente se preferir.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
