import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenários 1 e 2 do plano de testes da fase (1.18):
 * 1. Login → captura rápida com `#tag` → aparece no inbox.
 * 2. Processar: escolher espaço e tipo → sai do inbox.
 */
test("captura rápida com #tag aparece no inbox e sai de lá ao processar", async ({ page }) => {
  const run = Date.now();
  const title = `Item de teste E2E ${run}`;
  const tagName = `e2eteste${run}`;
  const spaceName = `Espaço E2E ${run}`;

  await login(page);

  // 1) Captura rápida (atalho do topo) com um #tag no texto.
  await page.getByRole("button", { name: "Capturar" }).click();
  const textarea = page.getByPlaceholder("Título na primeira linha, o resto vira corpo. #tag vira tag.");
  await textarea.fill(`${title} #${tagName}`);
  // Enter (sem Shift) já submete o formulário — evita ambiguidade com o botão
  // "Capturar" da barra do topo, que continua no DOM atrás do diálogo.
  await textarea.press("Enter");
  await expect(page.getByRole("heading", { name: "Captura rápida" })).not.toBeVisible();

  await page.goto("/inbox");
  const row = page.getByRole("button", { name: new RegExp(title) });
  await expect(row).toBeVisible();
  await expect(page.getByText(`#${tagName}`)).toBeVisible();

  // 2) Processar: cria um espaço novo e move o item pra lá — deve sair do inbox.
  await page.getByRole("button", { name: "Novo espaço" }).click();
  await page.getByPlaceholder("Nome do espaço").fill(spaceName);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(page.getByRole("link", { name: spaceName })).toBeVisible();

  await page.goto("/inbox");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await page.getByLabel("Espaço").selectOption({ label: spaceName });

  await expect(page.getByRole("button", { name: new RegExp(title) })).not.toBeVisible();
});
