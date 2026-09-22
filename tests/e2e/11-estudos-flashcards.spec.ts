import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário de E2E da fase 5.13: instalar o pack Estudos → criar uma nota →
 * gerar flashcards com IA a partir dela → revisar 3 cards.
 *
 * **Mesma limitação já registrada na 06-transcricao-e-resumo.spec.ts (2.11)
 * e em `docs/decisoes.md`**: `callClaudeJson` (`src/lib/ai/claude.ts`) não
 * tem um provedor mock determinístico — só um `ANTHROPIC_API_KEY` de
 * verdade faz "Gerar" (dentro de `GenerateFlashcardsDialog`) terminar. O
 * "IA mockada" do enunciado da 5.13 não existe hoje neste app (mesma
 * lacuna, mesma decisão em aberto); os passos abaixo dependem de uma conta
 * de teste com a chave configurada, e o timeout de geração é generoso por
 * isso. Escrito com cuidado a partir do código de verdade
 * (`generate-flashcards-dialog.tsx`), nunca executado neste sandbox (sem
 * Docker/Supabase local nem chave de IA aqui).
 */
test("instalar Estudos, gerar flashcards de uma nota com IA e revisar 3 cards", async ({ page }) => {
  const run = Date.now();
  const noteTitle = `Nota de estudo E2E ${run}`;
  const noteBody =
    "A fotossíntese é o processo pelo qual plantas convertem luz solar em energia química. " +
    "Ocorre nos cloroplastos, usando clorofila pra capturar luz. O subproduto é oxigênio, liberado pras folhas.";

  await login(page);

  // Instala o pack Estudos (5.2/5.7), sem exemplos — só precisamos do tipo Flashcard e da tela de geração.
  await page.goto("/configuracoes/metodos");
  const estudosCard = page.getByRole("heading", { name: "Estudos" }).locator("xpath=ancestor::*[self::article or self::div][1]");
  await estudosCard.getByRole("button", { name: "Instalar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Instalar", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Cria a nota de origem via captura rápida — vira uma nota comum (sem tipo), que a IA lê pelo `content_text`.
  await page.getByRole("button", { name: "Capturar" }).click();
  const textarea = page.getByPlaceholder("Título na primeira linha, o resto vira corpo. #tag vira tag.");
  await textarea.fill(`${noteTitle}\n${noteBody}`);
  await textarea.press("Enter");
  await expect(page.getByRole("heading", { name: "Captura rápida" })).not.toBeVisible();

  // Gera flashcards a partir da nota (/estudos).
  await page.goto("/estudos");
  await page.getByRole("button", { name: "Gerar com IA" }).click();
  await expect(page.getByRole("heading", { name: "Gerar flashcards com IA" })).toBeVisible();

  await page.getByPlaceholder("Buscar item…").fill(noteTitle);
  await page.getByRole("button", { name: new RegExp(noteTitle) }).click();

  await page.getByRole("button", { name: "Gerar", exact: true }).click();
  // Chamada de IA de verdade — timeout generoso (mesmo espírito da 06).
  await expect(page.getByRole("button", { name: /^Criar \d+ flashcards?$/ })).toBeVisible({ timeout: 2 * 60_000 });

  await page.getByRole("button", { name: /^Criar \d+ flashcards?$/ }).click();
  await expect(page.getByRole("heading", { name: "Gerar flashcards com IA" })).not.toBeVisible();

  // Revisa 3 cards em /estudos/revisar (espaço mostra resposta, "3" avalia como "Bom" — atalhos de teclado, 5.7).
  await page.goto("/estudos/revisar");
  for (let i = 0; i < 3; i += 1) {
    await expect(page.getByRole("button", { name: "Mostrar resposta" })).toBeVisible();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /Bom/ }).click();
  }
});
