import { describe, expect, it } from "vitest";
import { createShareLinkSchema } from "./schemas";

const id = "4f1c2d3e-0000-4000-8000-000000000001";

describe("link de edição de lista", () => {
  it("exige o nome de quem vai usar (um link por pessoa)", () => {
    expect(createShareLinkSchema.safeParse({ resourceId: id, permission: "edit" }).success).toBe(false);
    expect(createShareLinkSchema.safeParse({ resourceId: id, permission: "edit", label: "  " }).success).toBe(false);
    expect(createShareLinkSchema.safeParse({ resourceId: id, permission: "edit", label: "Pedro" }).success).toBe(true);
  });

  it("só vale pra item, não pra espaço, conta ou divisão", () => {
    for (const resourceType of ["space", "split", "bill"] as const) {
      expect(createShareLinkSchema.safeParse({ resourceId: id, resourceType, permission: "edit", label: "Pedro" }).success).toBe(false);
    }
  });
});
