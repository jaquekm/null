import { describe, expect, it } from "vitest";
import { sha256OfFile } from "./sha256";

describe("sha256OfFile", () => {
  it("calcula o sha256 esperado de um conteúdo conhecido", async () => {
    const blob = new Blob(["hello world"], { type: "text/plain" });
    const hash = await sha256OfFile(blob);
    // sha256("hello world") — valor de referência conhecido.
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("mesmo conteúdo produz o mesmo hash", async () => {
    const a = await sha256OfFile(new Blob(["conteúdo"]));
    const b = await sha256OfFile(new Blob(["conteúdo"]));
    expect(a).toBe(b);
  });

  it("conteúdos diferentes produzem hashes diferentes", async () => {
    const a = await sha256OfFile(new Blob(["a"]));
    const b = await sha256OfFile(new Blob(["b"]));
    expect(a).not.toBe(b);
  });
});
