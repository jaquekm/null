import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 6 do plano de testes da fase (1.18):
 * `POST /api/capture` com token válido cria item; com token revogado
 * retorna 401. Os tokens são criados pela própria UI (`/configuracoes/tokens`,
 * 1.11) — mais fiel do que inserir direto no banco.
 */
test("POST /api/capture: token válido cria item, token revogado dá 401", async ({ page }) => {
  const run = Date.now();

  await login(page);
  await page.goto("/configuracoes/tokens");

  async function createToken(name: string): Promise<string> {
    await page.getByLabel("Nome").fill(name);
    await page.getByRole("button", { name: "Criar token" }).click();
    const code = page.locator("code").first();
    await expect(code).toBeVisible();
    const value = await code.textContent();
    if (!value) throw new Error(`Token "${name}" não foi revelado depois de criar.`);
    await page.getByRole("button", { name: "Já copiei, fechar" }).click();
    return value.trim();
  }

  const validToken = await createToken(`E2E válido ${run}`);
  const revokeTokenName = `E2E revogado ${run}`;
  const tokenToRevoke = await createToken(revokeTokenName);

  page.once("dialog", (dialog) => dialog.accept());
  const row = page.locator("li").filter({ hasText: revokeTokenName });
  await row.getByRole("button", { name: "Revogar" }).click();
  await expect(row.getByText("revogado")).toBeVisible();

  const okResponse = await page.request.post("/api/capture", {
    headers: { authorization: `Bearer ${validToken}` },
    data: { title: `Capturado via API E2E ${run}` },
  });
  expect(okResponse.status()).toBe(200);
  const okBody = (await okResponse.json()) as { id: string; url: string };
  expect(okBody.id).toBeTruthy();

  const revokedResponse = await page.request.post("/api/capture", {
    headers: { authorization: `Bearer ${tokenToRevoke}` },
    data: { title: `Não deveria criar ${run}` },
  });
  expect(revokedResponse.status()).toBe(401);
});
