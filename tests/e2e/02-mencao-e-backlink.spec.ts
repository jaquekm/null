import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 3 do plano de testes da fase (1.18):
 * Editar conteúdo com `[[` link → backlink aparece no destino.
 *
 * Usa o próprio menu de menção pra criar o item de destino na hora
 * (opção "+ Criar item", 1.7) — não precisa de um segundo item pré-existente.
 */
test("[[ cria/liga um item e o backlink aparece no destino", async ({ page }) => {
  const run = Date.now();
  const sourceTitle = `Item origem E2E ${run}`;
  const targetTitle = `Item alvo E2E ${run}`;

  await login(page);

  await page.getByRole("button", { name: "Capturar" }).click();
  const textarea = page.getByPlaceholder("Título na primeira linha, o resto vira corpo. #tag vira tag.");
  await textarea.fill(sourceTitle);
  await textarea.press("Enter");
  await expect(page.getByRole("heading", { name: "Captura rápida" })).not.toBeVisible();

  await page.getByRole("button", { name: "Abrir" }).click();
  await expect(page).toHaveURL(/\/itens\//);

  const editor = page.locator(".ProseMirror");
  await editor.click();
  await editor.pressSequentially(`[[${targetTitle}`);

  const createOption = page.getByRole("button", { name: `+ Criar item "${targetTitle}"` });
  await expect(createOption).toBeVisible();
  await createOption.click();

  // Espera o autosave (debounce de 800ms + ida ao servidor) terminar antes
  // de seguir o link da menção — senão a menção pode não estar persistida.
  await expect(page.getByText("Salvo")).toBeVisible({ timeout: 10_000 });

  const mentionLink = page.locator(".ProseMirror a.mention");
  await expect(mentionLink).toHaveText(`[[${targetTitle}]]`);
  const href = await mentionLink.getAttribute("href");
  expect(href).toBeTruthy();

  // Navega direto pela URL (não clica no link dentro do contenteditable —
  // em muitos navegadores um clique ali só move o cursor, não navega).
  await page.goto(href!);

  await expect(page.getByRole("heading", { name: "Backlinks" })).toBeVisible();
  await expect(page.getByRole("link", { name: sourceTitle })).toBeVisible();
});
