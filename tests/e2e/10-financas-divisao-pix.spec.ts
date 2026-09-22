import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 2 do plano de testes da fase (4.14): criar divisão → abrir link
 * público → ver QR Pix → "Já paguei" → dono confirma → saldo zera.
 */
test("criar divisão → abrir link público → ver QR Pix → já paguei → dono confirma → saldo zera", async ({ page, browser, baseURL }) => {
  const run = Date.now();
  const accountName = `Conta Pix E2E ${run}`;
  const contactName = `Contato Pix E2E ${run}`;
  const splitTitle = `Jantar E2E ${run}`;

  await login(page);

  // --- 0. Uma conta (pra registrar o pagamento depois) e um contato (participante da divisão). ---
  await page.goto("/financas/configurar");
  await page.getByRole("button", { name: "+ Nova conta" }).click();
  await page.getByLabel("Nome*").fill(accountName);
  await page.getByLabel("Saldo inicial*").fill("1000,00");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText(accountName)).toBeVisible();

  await page.goto("/contatos");
  await page.getByRole("button", { name: "Novo contato" }).click();
  await page.getByLabel("Nome*").fill(contactName);
  await page.getByRole("button", { name: "Criar contato" }).click();
  await expect(page.getByText("Contato criado.")).toBeVisible();

  // --- 1. Criar divisão: eu pago o total, dividido igual entre eu e o contato. ---
  await page.goto("/financas/dividir");
  await page.getByRole("button", { name: "Nova divisão" }).click();
  await page.getByLabel("Título*").fill(splitTitle);
  await page.getByLabel("Valor total*").fill("100,00");
  await page.getByLabel(contactName).check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Divisão criada.")).toBeVisible();

  // O contato entra devendo a metade (divisão igual, eu paguei o total).
  await expect(page.getByText(new RegExp(`${contactName} te deve`))).toBeVisible();

  // --- 2. Cobrar: cria o link público da parte do contato. ---
  const splitRow = page.getByRole("button", { name: new RegExp(splitTitle) });
  await splitRow.click();
  await page.getByRole("button", { name: "Cobrar" }).click();
  await page.getByRole("button", { name: "Criar link de cobrança" }).click();

  const urlInput = page.locator("input[readonly]");
  await expect(urlInput).toBeVisible();
  const shareUrl = await urlInput.inputValue();
  expect(shareUrl).toContain("/p/");
  await page.getByRole("button", { name: "Fechar" }).click();

  // --- 3. Abre o link público num contexto anônimo: vê o QR Pix e marca "Já paguei". ---
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(shareUrl.startsWith("http") ? shareUrl : `${baseURL}${shareUrl}`);

  await expect(anonPage.getByRole("heading", { name: splitTitle })).toBeVisible();
  await expect(anonPage.getByRole("heading", { name: "Pagar com Pix" })).toBeVisible();
  await expect(anonPage.getByAltText("QR Code Pix")).toBeVisible();
  // O valor (R$ 50,00) aparece tanto no card de resumo quanto no bloco do Pix — basta um dos dois.
  await expect(anonPage.getByText("R$ 50,00").first()).toBeVisible();

  await anonPage.getByRole("button", { name: "Já paguei" }).click();
  await expect(anonPage.getByText("Você marcou que já pagou.")).toBeVisible();
  await anonContext.close();

  // --- 4. Dono confirma o pagamento recebido: registra na conta criada acima. ---
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Registrar pagamento" })).toBeVisible();
  await page.getByLabel("Conta*").selectOption({ label: accountName });
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Pagamento registrado.")).toBeVisible();

  // --- 5. Saldo zera: a divisão some da aba "Abertas" e some da lista de saldos; no histórico, aparece "Quitada". ---
  await expect(page.getByText(new RegExp(`${contactName} te deve`))).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(splitTitle) })).not.toBeVisible();

  await page.getByRole("button", { name: "Histórico" }).click();
  const settledRow = page.getByRole("button", { name: new RegExp(splitTitle) });
  await expect(settledRow).toBeVisible();
  await expect(settledRow.getByText("Quitada")).toBeVisible();
});
