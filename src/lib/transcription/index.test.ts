import { beforeEach, describe, expect, it, vi } from "vitest";

let envMock: Record<string, string | undefined>;

vi.mock("@/lib/env", () => ({
  get serverEnv() {
    return envMock;
  },
}));

async function freshModule() {
  vi.resetModules();
  return import("./index");
}

describe("getTranscriptionProvider", () => {
  beforeEach(() => {
    envMock = {};
  });

  it("devolve null quando TRANSCRIPTION_PROVIDER ou TRANSCRIPTION_API_KEY não estão configurados", async () => {
    const { getTranscriptionProvider } = await freshModule();
    expect(getTranscriptionProvider()).toBeNull();
  });

  it("devolve o provedor AssemblyAI quando configurado", async () => {
    envMock = { TRANSCRIPTION_PROVIDER: "assemblyai", TRANSCRIPTION_API_KEY: "key" };
    const { getTranscriptionProvider } = await freshModule();
    const provider = getTranscriptionProvider();
    expect(provider?.name).toBe("assemblyai");
  });

  it("lança erro para um provedor desconhecido", async () => {
    envMock = { TRANSCRIPTION_PROVIDER: "outro-provedor", TRANSCRIPTION_API_KEY: "key" };
    const { getTranscriptionProvider } = await freshModule();
    expect(() => getTranscriptionProvider()).toThrow(/desconhecido/);
  });
});
