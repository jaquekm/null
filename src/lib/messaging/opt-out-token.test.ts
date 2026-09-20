import { describe, expect, it, vi } from "vitest";

const TEST_KEY = "dGVzdC1rZXktMzItYnl0ZXMtbG9uZy1mb3ItaG1hYyE=";
vi.mock("@/lib/env", () => ({ serverEnv: { ENCRYPTION_KEY: TEST_KEY } }));

const { buildOptOutToken, verifyOptOutToken } = await import("./opt-out-token");
const { hmacSha256Hex } = await import("@/lib/crypto");

describe("opt-out token", () => {
  it("ida e volta preserva o payload", () => {
    const token = buildOptOutToken({ contactId: "11111111-1111-4111-8111-111111111111", channel: "email" });
    expect(verifyOptOutToken(token)).toEqual({ contactId: "11111111-1111-4111-8111-111111111111", channel: "email" });
  });

  it("assinatura adulterada: null", () => {
    const token = buildOptOutToken({ contactId: "11111111-1111-4111-8111-111111111111", channel: "email" });
    const [encoded] = token.split(".");
    const fakeSignature = "0".repeat(64);
    expect(verifyOptOutToken(`${encoded}.${fakeSignature}`)).toBeNull();
  });

  it("payload adulterado (assinatura não bate mais): null", () => {
    const token = buildOptOutToken({ contactId: "11111111-1111-4111-8111-111111111111", channel: "email" });
    const [, signature] = token.split(".");
    const tamperedEncoded = Buffer.from(JSON.stringify({ contactId: "22222222-2222-4222-8222-222222222222", channel: "email" })).toString(
      "base64url",
    );
    expect(verifyOptOutToken(`${tamperedEncoded}.${signature}`)).toBeNull();
  });

  it("token sem o separador: null", () => {
    expect(verifyOptOutToken("isso-nao-e-um-token")).toBeNull();
  });

  it("token com JSON inválido depois de decodificado: null", () => {
    const encoded = Buffer.from("não é json").toString("base64url");
    expect(verifyOptOutToken(`${encoded}.qualquercoisa`)).toBeNull();
  });

  it("channel fora do enum (mesmo com assinatura válida): null", () => {
    // `buildOptOutToken` é tipado e não deixa montar um payload assim — testa a validação
    // do payload decodificado construindo a assinatura certa manualmente.
    const encoded = Buffer.from(JSON.stringify({ contactId: "x", channel: "sms" })).toString("base64url");
    const signature = hmacSha256Hex(TEST_KEY, encoded);
    expect(verifyOptOutToken(`${encoded}.${signature}`)).toBeNull();
  });
});
