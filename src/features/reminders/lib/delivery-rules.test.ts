import { describe, expect, it } from "vitest";
import { decideDelivery, type DeliveryDecisionInput } from "./delivery-rules";

function baseInput(overrides: Partial<DeliveryDecisionInput> = {}): DeliveryDecisionInput {
  return {
    isThirdParty: true,
    optedOutAt: null,
    channelOptIn: true,
    destination: "+5511999998888",
    occurrenceAt: new Date("2026-01-15T15:00:00.000Z"), // 12:00 em São Paulo
    timezone: "America/Sao_Paulo",
    deliveriesLast24h: 0,
    ...overrides,
  };
}

describe("decideDelivery", () => {
  it("tudo certo: permite", () => {
    expect(decideDelivery(baseInput())).toEqual({ allowed: true });
  });

  it("contato com opted_out_at: opt_out", () => {
    expect(decideDelivery(baseInput({ optedOutAt: "2026-01-01T00:00:00.000Z" }))).toEqual({
      allowed: false,
      reason: "opt_out",
    });
  });

  it("sem opt-in do canal: opt_out", () => {
    expect(decideDelivery(baseInput({ channelOptIn: false }))).toEqual({ allowed: false, reason: "opt_out" });
  });

  it("sem destino (telefone/e-mail ausente): no_destination", () => {
    expect(decideDelivery(baseInput({ destination: null }))).toEqual({ allowed: false, reason: "no_destination" });
  });

  it("ocorrência às 22h (horário silencioso): quiet_hours", () => {
    const occurrenceAt = new Date("2026-01-16T01:00:00.000Z"); // 22:00 local
    expect(decideDelivery(baseInput({ occurrenceAt }))).toEqual({ allowed: false, reason: "quiet_hours" });
  });

  it("horário silencioso, mas 'Enviar agora' ignora: permite", () => {
    const occurrenceAt = new Date("2026-01-16T01:00:00.000Z"); // 22:00 local
    expect(decideDelivery(baseInput({ occurrenceAt, bypassQuietHours: true }))).toEqual({ allowed: true });
  });

  it("horário silencioso não se aplica ao dono (isThirdParty: false)", () => {
    const occurrenceAt = new Date("2026-01-16T01:00:00.000Z"); // 22:00 local
    expect(decideDelivery(baseInput({ occurrenceAt, isThirdParty: false }))).toEqual({ allowed: true });
  });

  it("3 mensagens nas últimas 24h: rate_limit", () => {
    expect(decideDelivery(baseInput({ deliveriesLast24h: 3 }))).toEqual({ allowed: false, reason: "rate_limit" });
  });

  it("2 mensagens nas últimas 24h ainda permite", () => {
    expect(decideDelivery(baseInput({ deliveriesLast24h: 2 }))).toEqual({ allowed: true });
  });

  it("limite diário não se aplica ao dono", () => {
    expect(decideDelivery(baseInput({ deliveriesLast24h: 10, isThirdParty: false }))).toEqual({ allowed: true });
  });
});
