import { describe, expect, it } from "vitest";
import { pickExtractionStrategy } from "./pick-extraction-method";

describe("pickExtractionStrategy", () => {
  it("texto plano/markdown/csv vira 'plain'", () => {
    expect(pickExtractionStrategy("text/plain")).toBe("plain");
    expect(pickExtractionStrategy("text/markdown")).toBe("plain");
    expect(pickExtractionStrategy("text/csv")).toBe("plain");
  });

  it("docx vira 'docx'", () => {
    expect(pickExtractionStrategy("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
  });

  it("pdf vira 'pdf'", () => {
    expect(pickExtractionStrategy("application/pdf")).toBe("pdf");
  });

  it("qualquer image/* vira 'image'", () => {
    expect(pickExtractionStrategy("image/jpeg")).toBe("image");
    expect(pickExtractionStrategy("image/heic")).toBe("image");
  });

  it("MIME não elegível devolve null", () => {
    expect(pickExtractionStrategy("audio/webm")).toBeNull();
    expect(pickExtractionStrategy("video/mp4")).toBeNull();
    expect(pickExtractionStrategy("application/zip")).toBeNull();
  });
});
