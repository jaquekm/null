import { describe, expect, it } from "vitest";
import { buildStoragePath } from "./build-storage-path";

describe("buildStoragePath", () => {
  it("monta owner/item/uuid-nome", () => {
    expect(buildStoragePath("owner-1", "item-1", "uuid-1", "Foto.png")).toBe("owner-1/item-1/uuid-1-foto.png");
  });

  it("itemId nulo (anexo avulso, sem item — 4.8): usa 'avulso' no lugar", () => {
    expect(buildStoragePath("owner-1", null, "uuid-1", "boleto.pdf")).toBe("owner-1/avulso/uuid-1-boleto.pdf");
  });
});
