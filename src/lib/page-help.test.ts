import { describe, expect, it } from "vitest";
import { PAGE_HELP } from "./page-help";

describe("PAGE_HELP", () => {
  it("todo módulo tem título e pelo menos uma dica curta", () => {
    for (const [topic, help] of Object.entries(PAGE_HELP)) {
      expect(help.title, topic).toBeTruthy();
      expect(help.tips.length, topic).toBeGreaterThan(0);
      for (const tip of help.tips) expect(tip.length, `${topic}: ${tip}`).toBeLessThan(260);
    }
  });
});
