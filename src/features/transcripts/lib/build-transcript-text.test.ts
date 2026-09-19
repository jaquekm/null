import { describe, expect, it } from "vitest";
import { buildTranscriptText } from "./build-transcript-text";

describe("buildTranscriptText", () => {
  it("monta uma linha por segmento, com horário e locutor", () => {
    const text = buildTranscriptText(
      [
        { speaker: "A", start: 192, end: 200, text: "Bom dia, pessoal." },
        { speaker: "B", start: 220, end: 225, text: "Bom dia!" },
      ],
      {},
    );
    expect(text).toBe("[00:03:12] A: Bom dia, pessoal.\n[00:03:40] B: Bom dia!");
  });

  it("aplica speaker_names quando existirem", () => {
    const text = buildTranscriptText(
      [{ speaker: "A", start: 0, end: 5, text: "Oi" }],
      { A: "João" },
    );
    expect(text).toBe("[00:00:00] João: Oi");
  });

  it("locutor sem nome mapeado usa o rótulo cru do provedor", () => {
    const text = buildTranscriptText([{ speaker: "C", start: 0, end: 1, text: "..." }], { A: "João" });
    expect(text).toBe("[00:00:00] C: ...");
  });

  it("lista vazia dá string vazia", () => {
    expect(buildTranscriptText([], {})).toBe("");
  });
});
