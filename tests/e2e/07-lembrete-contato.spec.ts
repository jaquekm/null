import { formatInTimeZone } from "date-fns-tz";
import { expect, request, test } from "@playwright/test";
import { login } from "./utils";

/**
 * Cenário 1 do plano de testes da fase (3.12): contato com opt-in → lembrete
 * com pré-visualização → executar tick → entrega registrada.
 *
 * "Registrada" aqui não exige que o canal de verdade envie (Resend/N8N
 * podem não estar configurados neste ambiente) — só que a entrega saia de
 * "pendente" (fila) e apareça em "Enviados" ou "Com falha" depois do tick,
 * provando que `dispatch_reminders` processou a ocorrência de verdade.
 */
test("contato com opt-in → lembrete → tick → entrega registrada", async ({ page, baseURL }) => {
  const run = Date.now();
  const contactName = `Contato E2E ${run}`;
  const reminderTitle = `Lembrete E2E ${run}`;
  const timezone = "America/Sao_Paulo";

  await login(page);

  // Cria o contato com opt-in de e-mail (não depende de um telefone válido pro WhatsApp Business).
  await page.goto("/contatos");
  await page.getByRole("button", { name: "Novo contato" }).click();
  await page.getByLabel("Nome*").fill(contactName);
  await page.getByLabel("E-mail").fill(`e2e-${run}@example.com`);
  await page.getByRole("button", { name: "Criar contato" }).click();
  await expect(page.getByRole("link", { name: new RegExp(contactName) })).toBeVisible();

  await page.getByRole("link", { name: new RegExp(contactName) }).click();
  await expect(page).toHaveURL(/\/contatos\//);

  await page.getByRole("checkbox", { name: "Opt-in e-mail" }).check();
  await page.getByLabel("Origem do consentimento").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salvar consentimento" }).click();
  await expect(page.getByText("Consentimento salvo.")).toBeVisible();

  // Cria o lembrete pra esse contato, com envio há pouco no passado (já due pro tick).
  const sendAt = new Date(Date.now() - 2 * 60 * 1000);
  const date = formatInTimeZone(sendAt, timezone, "yyyy-MM-dd");
  const time = formatInTimeZone(sendAt, timezone, "HH:mm");

  await page.goto("/lembretes");
  await page.getByRole("button", { name: "Novo lembrete" }).click();
  await page.getByLabel("Título*").fill(reminderTitle);
  await page.getByLabel("Para quem").selectOption({ label: "Contatos" });
  await page.getByRole("checkbox", { name: contactName }).check();
  await page.getByLabel("Data").fill(date);
  await page.getByLabel("Hora").fill(time);
  await page
    .getByLabel(/Mensagem\*/)
    .fill("Oi {{nome}}, isso é um teste automatizado (E2E 3.12).");

  // Pré-visualização (enunciado da 3.12: "criar lembrete com pré-visualização").
  await expect(page.getByText("Oi", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Criar lembrete" }).click();
  await expect(page.getByText(reminderTitle)).toBeVisible();

  // Executa o tick — rota protegida por CRON_SECRET, chamada direto (não tem UI pra isso).
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET não definido — necessário pra chamar /api/jobs/tick nesse teste (ver .env.example).");
  }
  const api = await request.newContext({ baseURL });
  const tickResponse = await api.post("/api/jobs/tick", { headers: { authorization: `Bearer ${cronSecret}` } });
  expect(tickResponse.ok()).toBe(true);

  // Confere que a entrega saiu de "pendente": aparece em Enviados ou Com falha.
  await page.reload();
  await page.getByRole("button", { name: "Enviados" }).click();
  const sentRow = page.getByText(reminderTitle);
  const sentVisible = await sentRow.isVisible().catch(() => false);
  if (!sentVisible) {
    await page.getByRole("button", { name: "Com falha" }).click();
    await expect(page.getByText(reminderTitle)).toBeVisible();
  } else {
    await expect(sentRow).toBeVisible();
  }
});
