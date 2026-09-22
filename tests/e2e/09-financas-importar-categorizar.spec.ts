import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 1 do plano de testes da fase (4.14): configurar conta → importar
 * CSV → categorizar com regra → ver painel. A regra é criada ANTES da
 * importação de propósito — é o que faz a sugestão de categoria aparecer
 * já no preview (4.6, "sugerir na importação").
 */
test("configurar conta → importar CSV → categorizar com regra → ver painel", async ({ page }) => {
  const run = Date.now();
  const accountName = `Conta E2E ${run}`;
  const description = `MERCADO CENTRAL E2E ${run}`;

  await login(page);

  // --- 1. Configurar: cria a conta (categorias padrão, incluindo "Mercado", são semeadas ao abrir esta página pela primeira vez). ---
  await page.goto("/financas/configurar");
  await expect(page.getByRole("heading", { name: "Configurar Finanças" })).toBeVisible();

  await page.getByRole("button", { name: "+ Nova conta" }).click();
  await page.getByLabel("Nome*").fill(accountName);
  await page.getByLabel("Saldo inicial*").fill("1000,00");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText(accountName)).toBeVisible();

  // --- 2. Categorizar com regra: descrição contendo "MERCADO" → categoria "Mercado". ---
  await page.goto("/financas/regras");
  await page.getByRole("button", { name: "+ Nova regra" }).click();
  await page.getByLabel("Padrão*").fill("MERCADO");
  await page.getByLabel("Categoria").selectOption({ label: "Mercado" });
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Regra criada.")).toBeVisible();

  // --- 3. Importar CSV: ; como separador, , decimal, dd/MM/yyyy — os padrões já pré-selecionados na tela de mapeamento. ---
  await page.goto("/financas/importar");
  await page.getByLabel("Conta").selectOption({ label: accountName });

  const csvContent = `Data;Descrição;Valor\r\n05/01/2026;${description};-89,90\r\n`;
  await page.locator('input[type="file"]').setInputFiles({
    name: "extrato-e2e.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csvContent, "utf-8"),
  });

  await expect(page.getByText("confira o mapeamento de colunas")).toBeVisible();
  // As três colunas do CSV, nessa ordem: Data, Descrição, Valor (os três primeiros <select> da tela são separador/decimal/formato de data, já corretos por padrão).
  const columnSelects = page.locator("select");
  await columnSelects.nth(3).selectOption({ label: "Data" });
  await columnSelects.nth(4).selectOption({ label: "Descrição" });
  await columnSelects.nth(5).selectOption({ label: "Valor" });

  await page.getByRole("button", { name: "Continuar" }).click();

  // Preview: a regra já devia ter sugerido "Mercado" pra essa linha.
  const previewRow = page.getByRole("row", { name: new RegExp(description) });
  await expect(previewRow).toBeVisible();
  await expect(previewRow.locator("select")).not.toHaveValue("");

  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText(/lançamento\(s\) importado\(s\)/)).toBeVisible();

  // --- 4. Ver painel: o gasto entra no painel financeiro (maiores gastos / fluxo do mês). ---
  await page.goto("/financas");
  await expect(page.getByRole("heading", { name: "Painel financeiro" })).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
});
