import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("responde status ok com hora e versão, sem detalhes internos", async () => {
    const response = GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(new Date(body.time).toISOString()).toBe(body.time);
    expect(typeof body.version).toBe("string");
    expect(Object.keys(body).sort()).toEqual(["status", "time", "version"]);
  });
});
