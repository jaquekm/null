import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário de E2E da fase 5.13: arrastar uma barra na Linha do tempo altera
 * as datas do item.
 *
 * Usa a visão "Cronograma" do pack Projetos e planejamentos (5.8, já vem
 * configurada com `startField: "start"`/`endField: "prazo"` na Tarefa) em
 * vez de criar uma visão do zero — evita depender de uma UI de configurar
 * `startField`/`endField` que este teste não confirmou em detalhe. Escrito
 * com cuidado a partir do código de verdade (`timeline-view.tsx`), nunca
 * executado neste sandbox.
 */
test("arrastar uma barra na Linha do tempo altera a data da tarefa", async ({ page }) => {
  const run = Date.now();
  const taskTitle = `Tarefa Cronograma E2E ${run}`;

  await login(page);

  // Instala o pack Projetos e planejamentos (5.8) — cria a visão Cronograma na Tarefa.
  await page.goto("/configuracoes/metodos");
  const projetosCard = page.getByRole("heading", { name: "Projetos e planejamentos" }).locator("xpath=ancestor::*[self::article or self::div][1]");
  await projetosCard.getByRole("button", { name: "Instalar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Instalar", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Cria a tarefa e preenche Início/Prazo — a barra só aparece na Linha do tempo com os dois preenchidos.
  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByPlaceholder("Título").fill(taskTitle);
  await page.getByLabel("Tipo").selectOption({ label: "Tarefa" });
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(page).toHaveURL(/\/itens\//);

  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const dueDate = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("Início").fill(start);
  await page.getByLabel("Prazo").fill(dueDate);

  // Abre a visão Cronograma (Linha do tempo) — a Tarefa é um tipo global, então a visão aparece em qualquer espaço.
  await page.goto("/espacos");
  await page.getByRole("link", { name: "Tarefa", exact: true }).first().click();
  await page.getByRole("link", { name: "Cronograma" }).click();

  // Semana dá mais precisão de pixel-por-dia pro drag abaixo.
  await page.getByRole("button", { name: "Semana" }).click();

  const bar = page.getByText(taskTitle, { exact: true }).first();
  const barBox = await bar.boundingBox();
  if (!barBox) throw new Error("Não achou a barra da tarefa na Linha do tempo.");

  // Drag pelo corpo da barra (não pelas bordas de redimensionar) — move tudo, mantendo a duração.
  await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(barBox.x + barBox.width / 2 + 40, barBox.y + barBox.height / 2, { steps: 10 });
  await page.mouse.up();

  // Confirma que persistiu de verdade, olhando os campos no próprio item (mais confiável que reler pixels).
  await page.goto("/buscar");
  await page.getByPlaceholder("Buscar…").fill(taskTitle);
  await page.getByRole("link", { name: taskTitle }).first().click();
  await expect(page).toHaveURL(/\/itens\//);

  const startValue = await page.getByLabel("Início").inputValue();
  expect(startValue).not.toBe(start);
});
