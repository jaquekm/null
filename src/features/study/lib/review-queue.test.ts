import { describe, expect, it } from "vitest";
import { buildReviewQueue } from "./review-queue";

describe("buildReviewQueue", () => {
  it("inclui todos os due cards e todos os novos quando dentro do limite", () => {
    const due = ["d1", "d2", "d3"];
    const news = ["n1", "n2", "n3", "n4", "n5"];
    expect(buildReviewQueue(due, news, { dailyNewLimit: 20, newAlreadyShownToday: 0 })).toEqual(["d1", "d2", "d3", "n1", "n2", "n3", "n4", "n5"]);
  });

  it("corta os novos pelo que resta do limite diário", () => {
    const due = ["d1", "d2"];
    const news = Array.from({ length: 10 }, (_, i) => `n${i + 1}`);
    expect(buildReviewQueue(due, news, { dailyNewLimit: 5, newAlreadyShownToday: 3 })).toEqual(["d1", "d2", "n1", "n2"]);
  });

  it("zera os novos quando o limite diário já foi atingido, mas mantém os due", () => {
    const due = ["d1"];
    const news = ["n1", "n2"];
    expect(buildReviewQueue(due, news, { dailyNewLimit: 5, newAlreadyShownToday: 10 })).toEqual(["d1"]);
  });
});
