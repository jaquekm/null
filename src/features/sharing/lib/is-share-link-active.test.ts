import { describe, expect, it } from "vitest";
import { isShareLinkActive } from "./is-share-link-active";

const now = new Date("2026-01-15T12:00:00.000Z");

describe("isShareLinkActive", () => {
  it("sem revoked_at nem expires_at: ativo (sem validade)", () => {
    expect(isShareLinkActive({ revokedAt: null, expiresAt: null }, now)).toBe(true);
  });

  it("expires_at no futuro: ativo", () => {
    expect(isShareLinkActive({ revokedAt: null, expiresAt: "2026-02-01T00:00:00.000Z" }, now)).toBe(true);
  });

  it("expires_at no passado: inativo", () => {
    expect(isShareLinkActive({ revokedAt: null, expiresAt: "2026-01-01T00:00:00.000Z" }, now)).toBe(false);
  });

  it("revoked_at preenchido: inativo, mesmo sem expirar", () => {
    expect(isShareLinkActive({ revokedAt: "2026-01-10T00:00:00.000Z", expiresAt: "2026-02-01T00:00:00.000Z" }, now)).toBe(false);
  });
});
