import { describe, expect, it } from "vitest";
import { buildStoragePath } from "./build-storage-path";

describe("buildStoragePath", () => {
  it("monta owner/item/uuid-nome", () => {
    expect(buildStoragePath("owner-1", "item-1", "uuid-1", "Foto.png")).toBe("owner-1/item-1/uuid-1-foto.png");
  });
});
