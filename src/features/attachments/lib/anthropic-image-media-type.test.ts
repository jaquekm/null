import { describe, expect, it } from "vitest";
import { toAnthropicImageMediaType } from "./anthropic-image-media-type";

describe("toAnthropicImageMediaType", () => {
  it("aceita os 4 formatos suportados pela API", () => {
    expect(toAnthropicImageMediaType("image/jpeg")).toBe("image/jpeg");
    expect(toAnthropicImageMediaType("image/png")).toBe("image/png");
    expect(toAnthropicImageMediaType("image/gif")).toBe("image/gif");
    expect(toAnthropicImageMediaType("image/webp")).toBe("image/webp");
  });

  it("devolve null pra formatos não suportados", () => {
    expect(toAnthropicImageMediaType("image/heic")).toBeNull();
    expect(toAnthropicImageMediaType("image/bmp")).toBeNull();
    expect(toAnthropicImageMediaType("image/tiff")).toBeNull();
  });
});
