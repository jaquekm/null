import { describe, expect, it } from "vitest";
import { extensionForMimeType, pickRecordingMimeType } from "./pick-mime-type";

describe("pickRecordingMimeType", () => {
  it("prefere audio/webm;codecs=opus quando suportado", () => {
    const isSupported = (type: string) => type === "audio/webm;codecs=opus" || type === "audio/mp4";
    expect(pickRecordingMimeType(isSupported)).toBe("audio/webm;codecs=opus");
  });

  it("cai para audio/mp4 quando só ele é suportado (Safari/iOS)", () => {
    const isSupported = (type: string) => type === "audio/mp4";
    expect(pickRecordingMimeType(isSupported)).toBe("audio/mp4");
  });

  it("devolve null quando nenhum formato é suportado", () => {
    expect(pickRecordingMimeType(() => false)).toBeNull();
  });
});

describe("extensionForMimeType", () => {
  it("mp4 vira m4a", () => {
    expect(extensionForMimeType("audio/mp4")).toBe("m4a");
  });

  it("webm (e qualquer outro) vira webm", () => {
    expect(extensionForMimeType("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMimeType("audio/ogg")).toBe("webm");
  });
});
