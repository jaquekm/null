import { expect, request, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 2 do plano de testes da fase (6.10): perguntar à base → resposta
 * com citação clicável abre o item.
 *
 * **Mesma situação da `06-transcricao-e-resumo`**: escrito com cuidado,
 * nunca executado neste sandbox. Precisa de `EMBEDDINGS_API_KEY`/
 * `ANTHROPIC_API_KEY` de verdade (6.5/6.7) — os dois provedores de IA não
 * têm um modo de teste determinístico hoje (mesma decisão em aberto já
 * registrada em `docs/decisoes.md` desde a 2.11, não uma pendência nova
 * desta tarefa). Além disso, `index_item` (6.5) tem um debounce fixo de
 * 2 minutos (`enqueueIndexItem`) antes de ficar elegível pro tick — o
 * `waitForTimeout` abaixo é por causa disso, não flakiness.
 */
test("perguntar à base → resposta com citação clicável abre o item", async ({ page, baseURL }) => {
  const run = Date.now();
  const noteTitle = `Nota E2E pergunte-a-base ${run}`;
  const noteBody = `Marco de teste automatizado: o código secreto do dia é GALO-${run}.`;

  await login(page);

  // Cria uma nota com um trecho de texto único e fácil de reconhecer na resposta.
  await page.getByRole("button", { name: "Capturar" }).click();
  const textarea = page.getByPlaceholder("Título na primeira linha, o resto vira corpo. #tag vira tag.");
  await textarea.fill(`${noteTitle}\n${noteBody}`);
  await textarea.press("Enter");
  await expect(page.getByRole("heading", { name: "Captura rápida" })).not.toBeVisible();

  // `index_item` só fica elegível pro tick depois do debounce de 2 min (6.5).
  await page.waitForTimeout(2 * 60 * 1000 + 5_000);

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET não definido — necessário pra chamar /api/jobs/tick nesse teste (ver .env.example).");
  }
  const api = await request.newContext({ baseURL });
  const tickResponse = await api.post("/api/jobs/tick", { headers: { authorization: `Bearer ${cronSecret}` } });
  expect(tickResponse.ok()).toBe(true);

  await page.goto("/perguntar");
  await page.getByPlaceholder("Pergunte alguma coisa sobre sua base...").fill("Qual é o código secreto do dia?");
  await page.getByRole("button", { name: "Perguntar" }).click();

  // Streaming da resposta (6.7) — espera terminar ("Pensando…" some) antes de procurar a citação.
  await expect(page.getByText("Pensando…")).not.toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(`GALO-${run}`)).toBeVisible();

  const citation = page.getByRole("link", { name: /^\[\d+\]$/ }).first();
  await expect(citation).toBeVisible();
  await citation.click();
  await expect(page).toHaveURL(/\/itens\//);
  await expect(page.getByRole("heading", { name: noteTitle })).toBeVisible();
});
