import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário de E2E da fase 5.13: criar um canvas → arrastar 2 itens pra dentro
 * → conectar → recarregar e ver as posições salvas.
 *
 * **Risco conhecido, registrado aqui em vez de escondido**: arrastar um
 * item da barra lateral do canvas usa a API nativa de drag-and-drop do
 * HTML5 (`draggable`/`dataTransfer`, `canvas-workspace.tsx`), não
 * `@dnd-kit` (que é o que `04-kanban.spec.ts` usa com `page.mouse.*`) — por
 * isso este teste usa `locator.dragTo()` (que o Chromium traduz pra
 * eventos nativos de verdade) em vez de `page.mouse.move/down/up` pra essa
 * parte específica. Já mover um nó já colocado no canvas é um drag comum
 * de ponteiro (React Flow), então usa `page.mouse.*` normalmente, igual a
 * 04. Escrito com cuidado a partir do código de verdade
 * (`canvas-workspace.tsx`, `canvas-nodes.tsx`, `canvas-edge.tsx`), nunca
 * executado neste sandbox.
 */
test("criar canvas, arrastar 2 itens, conectar e recarregar mantém as posições", async ({ page }) => {
  const run = Date.now();
  const itemATitle = `Item Canvas A ${run}`;
  const itemBTitle = `Item Canvas B ${run}`;

  await login(page);

  // Cria os dois itens que vão pro canvas.
  for (const title of [itemATitle, itemBTitle]) {
    await page.getByRole("button", { name: "Novo" }).click();
    await page.getByPlaceholder("Título").fill(title);
    await page.getByRole("button", { name: "Criar", exact: true }).click();
    await expect(page).toHaveURL(/\/itens\//);
  }

  // Cria o canvas (tipo de sistema "Canvas", 5.5) a partir do espaço/inbox.
  await page.goto("/inbox");
  await page.getByRole("button", { name: "Canvas" }).click();
  await expect(page).toHaveURL(/\/itens\//);

  // Abre a barra "Arrastar item" e arrasta os dois itens pro canvas.
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await expect(page.getByRole("heading", { name: "Arrastar item" })).toBeVisible();

  const pane = page.locator(".react-flow__pane");
  await page.getByPlaceholder("Buscar itens…").fill(itemATitle);
  await page.getByText(itemATitle, { exact: true }).first().dragTo(pane, { targetPosition: { x: 200, y: 200 } });
  await expect(page.getByText(itemATitle, { exact: true })).toBeVisible();

  await page.getByPlaceholder("Buscar itens…").fill(itemBTitle);
  await page.getByText(itemBTitle, { exact: true }).first().dragTo(pane, { targetPosition: { x: 500, y: 400 } });
  await expect(page.getByText(itemBTitle, { exact: true })).toBeVisible();

  // Reposiciona o nó A com um drag de ponteiro comum (React Flow), não a API nativa acima.
  const nodeA = page.locator(".react-flow__node", { hasText: itemATitle });
  const nodeABoxBefore = await nodeA.boundingBox();
  if (!nodeABoxBefore) throw new Error("Não achou o nó A no canvas.");
  await page.mouse.move(nodeABoxBefore.x + nodeABoxBefore.width / 2, nodeABoxBefore.y + nodeABoxBefore.height / 2);
  await page.mouse.down();
  await page.mouse.move(nodeABoxBefore.x + 80, nodeABoxBefore.y + 60, { steps: 10 });
  await page.mouse.up();
  const nodeABoxAfter = await nodeA.boundingBox();
  if (!nodeABoxAfter) throw new Error("Nó A sumiu depois do drag.");
  expect(nodeABoxAfter.x).not.toBeCloseTo(nodeABoxBefore.x, 0);

  // Conecta A → B: arrasta do handle de origem (embaixo) de A pro handle de destino (em cima) de B.
  const sourceHandle = nodeA.locator(".react-flow__handle-bottom").first();
  const nodeB = page.locator(".react-flow__node", { hasText: itemBTitle });
  const targetHandle = nodeB.locator(".react-flow__handle-top").first();
  await sourceHandle.dragTo(targetHandle);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  // Espera o debounce de posição (500ms, `POSITION_SAVE_DEBOUNCE_MS`) antes de recarregar.
  await page.waitForTimeout(800);
  await page.reload();

  await expect(page.locator(".react-flow__node", { hasText: itemATitle })).toBeVisible();
  await expect(page.locator(".react-flow__node", { hasText: itemBTitle })).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  const nodeABoxAfterReload = await page.locator(".react-flow__node", { hasText: itemATitle }).boundingBox();
  if (!nodeABoxAfterReload) throw new Error("Nó A sumiu depois de recarregar.");
  expect(Math.abs(nodeABoxAfterReload.x - nodeABoxAfter.x)).toBeLessThan(20);
});
