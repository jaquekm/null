import { expect, request, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 1 do plano de testes da fase (6.10): gerar relatório financeiro
 * do mês → baixar PDF → compartilhar → abrir link anônimo.
 *
 * "Gerar agora" (`generateReportNow`, 6.4) só enfileira o job
 * `generate_report` — precisa do tick (mesmo padrão de `07-lembrete-contato`)
 * pra virar de verdade uma execução com PDF, antes de "Baixar PDF"/
 * "Compartilhar" aparecerem na tela.
 */
test("relatório financeiro do mês → baixar PDF → compartilhar → abrir link anônimo", async ({ page, browser, baseURL }) => {
  await login(page);

  await page.goto("/relatorios");
  const financeCard = page.locator("div", { has: page.getByText("Financeiro mensal", { exact: true }) }).first();
  await financeCard.getByRole("button", { name: "Gerar agora" }).click();
  await expect(page.getByText("Gerando relatório")).toBeVisible();

  // Executa o tick — rota protegida por CRON_SECRET, chamada direto (mesmo padrão de `07-lembrete-contato`).
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET não definido — necessário pra chamar /api/jobs/tick nesse teste (ver .env.example).");
  }
  const api = await request.newContext({ baseURL });
  const tickResponse = await api.post("/api/jobs/tick", { headers: { authorization: `Bearer ${cronSecret}` } });
  expect(tickResponse.ok()).toBe(true);

  // A execução mais recente do histórico (ordenado por criação desc, `listReportRuns`) é a que acabamos de gerar.
  await page.reload();
  const firstRun = page.getByRole("link").filter({ hasText: "Financeiro mensal" }).first();
  await expect(firstRun).toBeVisible();
  await firstRun.click();
  await expect(page).toHaveURL(/\/relatorios\/execucoes\//);

  // Baixar PDF — link direto pro anexo, o job só entrega `pdfAttachmentId` quando o PDF foi gerado com sucesso.
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toBeVisible();

  // Compartilhar: cria o link público.
  await page.getByRole("button", { name: "Compartilhar" }).click();
  const urlInput = page.locator("input[readonly]");
  await expect(urlInput).toBeVisible();
  const shareUrl = await urlInput.inputValue();
  expect(shareUrl).toContain("/p/");

  // Abre o link num contexto anônimo (sem sessão) — como um visitante de verdade.
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(shareUrl.startsWith("http") ? shareUrl : `${baseURL}${shareUrl}`);

  await expect(anonPage.getByText("Financeiro mensal", { exact: true })).toBeVisible();
  await expect(anonPage.getByRole("link", { name: "Baixar PDF" })).toBeVisible();

  await anonContext.close();
});
