import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 2 do plano de testes da fase (3.12): compartilhar item → abrir
 * link em contexto anônimo → comentar → comentário aparece pro dono.
 */
test("compartilhar item → abrir link anônimo → comentar → comentário aparece pro dono", async ({ page, browser, baseURL }) => {
  const run = Date.now();
  const spaceName = `Espaço Compartilhar E2E ${run}`;
  const itemTitle = `Item compartilhado E2E ${run}`;
  const commentAuthor = `Visitante E2E ${run}`;
  const commentBody = `Comentário de teste automatizado (E2E 3.12) ${run}`;

  await login(page);

  // Cria um espaço e um item pra compartilhar.
  await page.getByRole("button", { name: "Novo espaço" }).click();
  await page.getByPlaceholder("Nome do espaço").fill(spaceName);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  const spaceLink = page.getByRole("link", { name: spaceName });
  await expect(spaceLink).toBeVisible();
  await spaceLink.click();
  await expect(page).toHaveURL(/\/espacos\//);

  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByPlaceholder("Título").fill(itemTitle);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(page).toHaveURL(/\/itens\//);

  // Cria o link "Ver e comentar", sem senha, validade padrão.
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await page.getByLabel("Permissão").selectOption({ label: "Ver e comentar" });
  await page.getByRole("button", { name: "Criar link" }).click();

  const urlInput = page.locator("input[readonly]");
  await expect(urlInput).toBeVisible();
  const shareUrl = await urlInput.inputValue();
  expect(shareUrl).toContain("/p/");
  await page.getByRole("button", { name: "Fechar" }).click();

  // Abre o link num contexto anônimo (sem sessão) — como um visitante de verdade.
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(shareUrl.startsWith("http") ? shareUrl : `${baseURL}${shareUrl}`);

  await expect(anonPage.getByRole("heading", { name: itemTitle })).toBeVisible();
  await anonPage.getByPlaceholder("Seu nome").fill(commentAuthor);
  await anonPage.getByPlaceholder("Mensagem").fill(commentBody);
  await anonPage.getByRole("button", { name: "Enviar" }).click();
  await expect(anonPage.getByText("Comentário enviado. Obrigado!")).toBeVisible();
  await anonContext.close();

  // O comentário aparece pro dono, no próprio item.
  await page.reload();
  await expect(page.getByText(commentAuthor)).toBeVisible();
  await expect(page.getByText(commentBody)).toBeVisible();
});
