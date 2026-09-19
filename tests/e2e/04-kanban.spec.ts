import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 5 do plano de testes da fase (1.18): Kanban — arrastar card muda status.
 *
 * Usa o tipo "Tarefa" (semeado no onboarding, 1.3 — global, existe em
 * qualquer espaço) com seu campo "Status" (select: A fazer/Fazendo/Feito).
 * Cria um espaço e uma visão Kanban novos, pra não depender do estado
 * anterior da conta de teste.
 */
test("arrastar um card no Kanban muda o valor da coluna (Status)", async ({ page }) => {
  const run = Date.now();
  const spaceName = `Espaço Kanban E2E ${run}`;
  const taskTitle = `Tarefa E2E ${run}`;
  const viewName = `Kanban E2E ${run}`;

  await login(page);

  await page.getByRole("button", { name: "Novo espaço" }).click();
  await page.getByPlaceholder("Nome do espaço").fill(spaceName);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  const spaceLink = page.getByRole("link", { name: spaceName });
  await expect(spaceLink).toBeVisible();
  await spaceLink.click();
  await expect(page).toHaveURL(/\/espacos\//);
  const spaceUrl = page.url();

  // Cria a tarefa.
  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByPlaceholder("Título").fill(taskTitle);
  await page.getByLabel("Tipo").selectOption({ label: "Tarefa" });
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(page).toHaveURL(/\/itens\//);

  // Volta pro espaço e filtra por "Tarefa" — a visão precisa ser escopada a
  // um tipo pra "Agrupar por" oferecer os campos select dele.
  await page.goto(spaceUrl);
  await page.getByRole("link", { name: "Tarefa", exact: true }).click();

  await page.getByRole("button", { name: "Nova visão" }).click();
  await page.getByPlaceholder("Nome da visão").fill(viewName);
  await page.getByLabel("Tipo de visão").selectOption({ label: "Kanban" });
  await page.getByRole("button", { name: "Criar", exact: true }).click();

  await page.getByLabel("Agrupar por").selectOption({ label: "Status" });

  const feitoColumn = page.getByRole("heading", { name: "Feito", exact: true }).locator("xpath=../..");
  await expect(feitoColumn).toBeVisible();
  await expect(feitoColumn.getByText(taskTitle)).toHaveCount(0);

  const handle = page.getByLabel(`Reordenar ${taskTitle}`);
  const handleBox = await handle.boundingBox();
  const columnBox = await feitoColumn.boundingBox();
  if (!handleBox || !columnBox) throw new Error("Não achou a posição do card ou da coluna de destino.");

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  // Move um pouco antes do alvo: o dnd-kit só ativa o arraste depois de uma
  // distância mínima (activationConstraint, 4px) — ver kanban-view.tsx.
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 20, handleBox.y + handleBox.height / 2 + 20, { steps: 5 });
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + columnBox.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(feitoColumn.getByText(taskTitle)).toBeVisible();

  // Confirma que persistiu de verdade (não só otimista no cliente).
  await page.reload();
  await expect(feitoColumn.getByText(taskTitle)).toBeVisible();
});
