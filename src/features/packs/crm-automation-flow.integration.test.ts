import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { fakeUuid, FakeSupabase } from "@/lib/testing/fake-supabase";
import type { Job } from "@/lib/jobs/types";
import { installPack, type InstallPackOptions } from "./lib/install";
import { packSchema } from "./schemas";

/**
 * Integração da fase 5.13 ("Instalar CRM → mover oportunidade pra 'Ganho' →
 * conta a receber e projeto criados; executar de novo não duplica"):
 * encadeia `installPack` (5.2) de verdade com `runAutomations` (5.3) de
 * verdade — não mocka a resolução de `typeRef`/o motor de gatilhos, só o
 * enfileiramento de job (`enqueueJob`, como `run-automations.test.ts` já
 * faz) — pra provar que a automação "stage → Ganho" do pack shipado
 * (`packs/crm.json`) cria os registros de verdade, não só que cada peça
 * isolada bate com o mock dos vizinhos.
 */

const enqueueJob = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob }));

const { runAutomations } = await import("@/lib/jobs/handlers/run-automations");

const USER_ID = "user-1";

function client(fake: FakeSupabase) {
  return fake as unknown as SupabaseClient<Database>;
}

function job(payload: Record<string, unknown>): Job {
  return {
    id: "job-1",
    owner_id: USER_ID,
    kind: "run_automations",
    payload,
    status: "running",
    priority: 100,
    attempts: 0,
    max_attempts: 5,
    run_after: new Date().toISOString(),
    locked_at: null,
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Job;
}

async function loadCrmPack() {
  const raw = await readFile(path.join(process.cwd(), "packs", "crm.json"), "utf-8");
  return packSchema.parse(JSON.parse(raw));
}

beforeEach(() => {
  enqueueJob.mockClear();
});

describe("CRM: mover oportunidade pra Ganho (5.13, integração)", () => {
  it("cria a conta a receber e o projeto de onboarding de verdade", async () => {
    const fake = new FakeSupabase({}, (table, n) => fakeUuid(n));
    fake.seed("user_settings", [{ owner_id: USER_ID, modules: { finance: true } }]);

    const pack = await loadCrmPack();
    const options: InstallPackOptions = { spaceId: null };
    const installed = await installPack(client(fake), USER_ID, pack, options);
    expect(installed.ok).toBe(true);
    if (!installed.ok) return;

    const mapping = fake.rowsOf("packs_installed")[0]!.mapping as { types: Record<string, string> };
    const opportunityTypeId = mapping.types.opportunity!;

    const { data: opportunity } = await client(fake)
      .from("items")
      .insert({
        owner_id: USER_ID,
        type_id: opportunityTypeId,
        space_id: null,
        title: "Negócio X",
        status: "active",
        properties: { stage: "negociacao", value: 500000, contact: ["contact-1"] },
      })
      .select("id")
      .single();

    const payload = {
      event: { type: "property_changed", field: "stage", to: "ganho", from: "negociacao" },
      itemId: opportunity!.id,
      chainId: "chain-1",
      depth: 0,
    };
    const result = await runAutomations(job(payload), { supabase: fake as never });
    expect(result.status).toBe("done");

    const bills = fake.rowsOf("fin_bills");
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({ direction: "receivable", amount_cents: 500000, contact_id: "contact-1", item_id: opportunity!.id });

    const createdProjects = fake.rowsOf("items").filter((row) => row.title === "Onboarding — Negócio X");
    expect(createdProjects).toHaveLength(1);

    const runs = fake.rowsOf("automation_runs");
    expect(runs.some((run) => run.status === "success")).toBe(true);
  });

  it("reinstalar o pack não duplica a automação (idempotente)", async () => {
    const fake = new FakeSupabase({}, (table, n) => fakeUuid(n));
    fake.seed("user_settings", [{ owner_id: USER_ID, modules: { finance: true } }]);
    const pack = await loadCrmPack();
    const options: InstallPackOptions = { spaceId: null };

    await installPack(client(fake), USER_ID, pack, options);
    const second = await installPack(client(fake), USER_ID, pack, options);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.updated).toBe(true);
    expect(second.data.automationsCreated).toBe(0);

    const opportunityAutomations = fake.rowsOf("automations").filter((row) => row.name === "Oportunidade ganha");
    expect(opportunityAutomations).toHaveLength(1);
  });
});
