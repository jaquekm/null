import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import { listDocumentsToReview } from "./queries";

const USER_ID = "user-1";
const SPACE_ID = "space-1";

function client(fake: FakeSupabase) {
  return fake as unknown as SupabaseClient<Database>;
}

function seedDocumentType(fake: FakeSupabase) {
  fake.seed("object_types", [{ id: "doc-type-1", owner_id: USER_ID, slug: "documento" }]);
}

describe("listDocumentsToReview (5.10: painel \"Documentos a revisar\")", () => {
  it("sem o tipo Documento (onboarding não rodou ainda): lista vazia, sem erro", async () => {
    const fake = new FakeSupabase();
    const result = await listDocumentsToReview(client(fake), USER_ID, SPACE_ID, "2026-09-22");
    expect(result).toEqual([]);
  });

  it("só traz documentos deste espaço com revisar_em vencida, ordenados pela data mais antiga", async () => {
    const fake = new FakeSupabase();
    seedDocumentType(fake);
    fake.seed("items", [
      { id: "d1", owner_id: USER_ID, space_id: SPACE_ID, type_id: "doc-type-1", title: "Vencido há mais tempo", properties: { revisar_em: "2026-01-01" }, deleted_at: null },
      { id: "d2", owner_id: USER_ID, space_id: SPACE_ID, type_id: "doc-type-1", title: "Vencido recente", properties: { revisar_em: "2026-09-01" }, deleted_at: null },
      { id: "d3", owner_id: USER_ID, space_id: SPACE_ID, type_id: "doc-type-1", title: "Ainda no prazo", properties: { revisar_em: "2026-12-31" }, deleted_at: null },
      { id: "d4", owner_id: USER_ID, space_id: SPACE_ID, type_id: "doc-type-1", title: "Sem revisar_em", properties: {}, deleted_at: null },
      { id: "d5", owner_id: USER_ID, space_id: "outro-espaco", type_id: "doc-type-1", title: "Outro espaço", properties: { revisar_em: "2026-01-01" }, deleted_at: null },
    ]);

    const result = await listDocumentsToReview(client(fake), USER_ID, SPACE_ID, "2026-09-22");
    expect(result.map((d) => d.id)).toEqual(["d1", "d2"]);
  });
});
