import { expect, test } from "@playwright/test";
import { login } from "./utils";

/** Cenário 4 do plano de testes da fase (1.18): buscar pelo texto → encontra o item. */
test("busca pelo texto encontra o item", async ({ page }) => {
  const run = Date.now();
  const title = `Relatório trimestral de vendas E2E ${run}`;

  await login(page);

  await page.getByRole("button", { name: "Capturar" }).click();
  const textarea = page.getByPlaceholder("Título na primeira linha, o resto vira corpo. #tag vira tag.");
  await textarea.fill(title);
  await textarea.press("Enter");
  await expect(page.getByRole("heading", { name: "Captura rápida" })).not.toBeVisible();

  await page.goto("/buscar");
  await page.getByPlaceholder("Buscar... use #tag para filtrar por tag").fill("trimestral");

  await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 10_000 });
});
