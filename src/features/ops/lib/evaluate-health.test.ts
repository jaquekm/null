import { describe, expect, it } from "vitest";
import {
  evaluateAiBudget,
  evaluateBackupFresh,
  evaluateDatabaseConnectivity,
  evaluateGoogleConnection,
  evaluateJobsFailing,
  evaluateJobsTick,
  evaluateMcpTokensExpiring,
  evaluateOldShareLinks,
  evaluateStorageUsage,
} from "./evaluate-health";

const NOW = new Date("2026-01-10T12:00:00.000Z");

describe("evaluateDatabaseConnectivity", () => {
  it("ok quando a consulta funciona", () => expect(evaluateDatabaseConnectivity(true).ok).toBe(true));
  it("falha quando a consulta dá erro", () => expect(evaluateDatabaseConnectivity(false).ok).toBe(false));
});

describe("evaluateJobsTick", () => {
  it("sem tick nenhum: falha", () => expect(evaluateJobsTick(null, NOW).ok).toBe(false));
  it("tick há 4 minutos: ok", () => expect(evaluateJobsTick(new Date(NOW.getTime() - 4 * 60_000).toISOString(), NOW).ok).toBe(true));
  it("tick há 6 minutos: falha", () => expect(evaluateJobsTick(new Date(NOW.getTime() - 6 * 60_000).toISOString(), NOW).ok).toBe(false));
});

describe("evaluateJobsFailing", () => {
  it("zero falhas: ok", () => expect(evaluateJobsFailing(0).ok).toBe(true));
  it("uma falha: não ok", () => expect(evaluateJobsFailing(1).ok).toBe(false));
});

describe("evaluateBackupFresh", () => {
  it("databaseStale=false: ok", () => expect(evaluateBackupFresh(false).ok).toBe(true));
  it("databaseStale=true: não ok", () => expect(evaluateBackupFresh(true).ok).toBe(false));
});

describe("evaluateGoogleConnection", () => {
  it("sem revogada: ok", () => expect(evaluateGoogleConnection(false).ok).toBe(true));
  it("com revogada: não ok", () => expect(evaluateGoogleConnection(true).ok).toBe(false));
});

describe("evaluateAiBudget", () => {
  it("sem orçamento configurado: null (alerta desligado)", () => expect(evaluateAiBudget(50, undefined)).toBeNull());
  it("79% do orçamento: ok", () => expect(evaluateAiBudget(79, 100)!.ok).toBe(true));
  it("80% do orçamento: não ok (limiar é inclusivo)", () => expect(evaluateAiBudget(80, 100)!.ok).toBe(false));
  it("acima do orçamento: não ok", () => expect(evaluateAiBudget(120, 100)!.ok).toBe(false));
});

describe("evaluateMcpTokensExpiring", () => {
  it("nenhum expirando: ok", () => expect(evaluateMcpTokensExpiring(0).ok).toBe(true));
  it("um expirando: não ok", () => expect(evaluateMcpTokensExpiring(1).ok).toBe(false));
});

describe("evaluateOldShareLinks", () => {
  it("nenhum antigo sem validade: ok", () => expect(evaluateOldShareLinks(0).ok).toBe(true));
  it("um antigo sem validade: não ok", () => expect(evaluateOldShareLinks(2).ok).toBe(false));
});

describe("evaluateStorageUsage", () => {
  it("sem limite configurado: null (alerta desligado)", () => expect(evaluateStorageUsage(1000, undefined)).toBeNull());
  it("abaixo de 80%: ok", () => expect(evaluateStorageUsage(70, 100)!.ok).toBe(true));
  it("80% ou mais: não ok", () => expect(evaluateStorageUsage(80, 100)!.ok).toBe(false));
});
