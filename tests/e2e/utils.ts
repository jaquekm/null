import { expect, type Page } from "@playwright/test";

export function e2eCredentials(): { email: string; password: string } {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL/E2E_USER_PASSWORD não definidos — crie uma conta de teste já onboardada, sem MFA, e aponte pra ela (ver .env.example).",
    );
  }
  return { email, password };
}

/** Login pela UI (1.0) — usado no início de cada teste, não fica em `beforeAll` porque cada teste roda em contexto isolado. */
export async function login(page: Page): Promise<void> {
  const { email, password } = e2eCredentials();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  if (page.url().includes("/login/mfa")) {
    throw new Error("Conta de teste caiu na verificação MFA — use uma conta sem MFA para os testes E2E.");
  }
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
}
