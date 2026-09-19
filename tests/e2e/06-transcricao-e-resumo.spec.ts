import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário de E2E da fase 2 (2.11): enviar um áudio curto num item Reunião e
 * ver a transcrição e o resumo aparecerem, de ponta a ponta.
 *
 * **Prerequisito que este sandbox não tem**: a conta de teste precisa de
 * `TRANSCRIPTION_PROVIDER`/`TRANSCRIPTION_API_KEY` (2.4) e `ANTHROPIC_API_KEY`
 * (2.3) de verdade configurados no ambiente onde os testes rodam — sem isso
 * o upload funciona, mas a transcrição nunca sai de "queued"/"processing" (o
 * enunciado da 2.11 pede "provedor mock", mas os dois provedores externos
 * (transcrição e IA) não têm um modo de teste determinístico hoje; inventar
 * um só pra este teste, sem conseguir rodar e confirmar que funciona neste
 * sandbox, pareceu mais risco que valor — registrado em `docs/decisoes.md`
 * como uma decisão em aberto pro dono). Os timeouts abaixo são generosos
 * (minutos, não segundos) porque dependem de um provedor de verdade.
 *
 * Mesma situação da 1.18: escrito com cuidado, nunca executado neste
 * sandbox (sem Docker/Supabase local, sem conta de teste, e aqui também sem
 * as chaves de transcrição/IA).
 */
test("upload de áudio numa Reunião: transcrição e resumo aparecem no item", async ({ page }) => {
  const run = Date.now();
  const title = `Reunião E2E ${run}`;
  const audioPath = path.join(__dirname, "../fixtures/short-audio-sample.wav");

  await login(page);

  // Cria o item como tipo "Reunião" (semeado no onboarding, 1.3) — resumo automático ao terminar a transcrição (2.6).
  await page.getByRole("button", { name: "Capturar" }).click();
  const textarea = page.getByPlaceholder("Título na primeira linha, o resto vira corpo. #tag vira tag.");
  await textarea.fill(title);
  await page.getByLabel("Tipo").selectOption({ label: "Reunião" });
  // Enter (sem Shift) submete o formulário — evita ambiguidade com o botão
  // "Capturar" da barra do topo, que continua no DOM atrás do diálogo (mesmo cuidado da 1.18).
  await textarea.press("Enter");
  await expect(page.getByRole("heading", { name: "Captura rápida" })).not.toBeVisible();

  await page.goto("/inbox");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page).toHaveURL(/\/itens\//);

  // Anexa o áudio de teste e confirma a transcrição no prompt que aparece (2.5, ponto de entrada 3).
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "short-audio-sample.wav",
    mimeType: "audio/wav",
    buffer: readFileSync(audioPath),
  });
  await expect(page.getByText(`Transcrever "short-audio-sample.wav"?`)).toBeVisible();
  await page.getByRole("button", { name: "Transcrever", exact: true }).click();

  // Transcrevendo… (2.6/2.8) até o provedor de verdade concluir.
  await expect(page.getByText("Transcrevendo…")).toBeVisible();

  // Segmentos da transcrição aparecem (2.8) — generoso porque depende do provedor de verdade.
  await expect(page.locator("text=Transcrevendo…")).toBeHidden({ timeout: 5 * 60_000 });

  // Resumo gerado automaticamente por ser item Reunião (2.6/2.7).
  await expect(page.getByRole("heading", { name: "Resumo gerado" })).toBeVisible({ timeout: 5 * 60_000 });
});
