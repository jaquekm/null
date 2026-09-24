import { describe, expect, it } from "vitest";
import { findDuplicateCandidates } from "./detect-duplicates";

describe("findDuplicateCandidates", () => {
  it("casa por título normalizado (sem acento/maiúscula) + mesma data", () => {
    const matches = findDuplicateCandidates(
      [{ localId: "a", title: "Reunião de Terça", createdAt: "2026-01-10T12:00:00.000Z" }],
      [{ id: "existing-1", title: "reuniao de terca", createdAt: "2026-01-10T08:00:00.000Z" }],
    );
    expect(matches).toEqual([{ localId: "a", existingItemId: "existing-1", existingTitle: "reuniao de terca" }]);
  });

  it("mesmo título, data diferente: não é duplicata", () => {
    const matches = findDuplicateCandidates(
      [{ localId: "a", title: "Nota", createdAt: "2026-01-10T00:00:00.000Z" }],
      [{ id: "existing-1", title: "Nota", createdAt: "2026-02-01T00:00:00.000Z" }],
    );
    expect(matches).toEqual([]);
  });

  it("sem data conhecida no item importado: casa só pelo título", () => {
    const matches = findDuplicateCandidates(
      [{ localId: "a", title: "Lista de compras", createdAt: null }],
      [{ id: "existing-1", title: "Lista de compras", createdAt: "2026-03-01T00:00:00.000Z" }],
    );
    expect(matches).toEqual([{ localId: "a", existingItemId: "existing-1", existingTitle: "Lista de compras" }]);
  });

  it("título diferente: nunca duplicata", () => {
    const matches = findDuplicateCandidates(
      [{ localId: "a", title: "Nota A", createdAt: null }],
      [{ id: "existing-1", title: "Nota B", createdAt: "2026-01-01T00:00:00.000Z" }],
    );
    expect(matches).toEqual([]);
  });
});
