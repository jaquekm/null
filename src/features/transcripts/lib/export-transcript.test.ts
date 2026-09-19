import { describe, expect, it } from "vitest";
import { exportAsMarkdown, exportAsSrt, exportAsTxt } from "./export-transcript";

const segments = [
  { speaker: "A", start: 0, end: 2.5, text: "Bom dia." },
  { speaker: "B", start: 3, end: 5, text: "Bom dia, tudo bem?" },
];
const speakerNames = { A: "João" };

describe("exportAsTxt", () => {
  it("só o texto corrido, sem locutor nem tempo", () => {
    expect(exportAsTxt(segments)).toBe("Bom dia. Bom dia, tudo bem?");
  });
});

describe("exportAsMarkdown", () => {
  it("inclui locutor (com speaker_names quando existir) e horário", () => {
    const md = exportAsMarkdown(segments, speakerNames);
    expect(md).toContain("**João**");
    expect(md).toContain("[00:00:00]");
    expect(md).toContain("Bom dia.");
    expect(md).toContain("**B**"); // sem nome mapeado, usa o rótulo cru
  });
});

describe("exportAsSrt", () => {
  it("gera blocos numerados com timecode HH:MM:SS,mmm", () => {
    const srt = exportAsSrt(segments, speakerNames);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,500\nJoão: Bom dia.");
    expect(srt).toContain("2\n00:00:03,000 --> 00:00:05,000\nB: Bom dia, tudo bem?");
  });
});
