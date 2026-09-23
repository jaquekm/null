import { describe, expect, it } from "vitest";
import { splitNdjsonBuffer } from "./ndjson-stream";

describe("splitNdjsonBuffer", () => {
  it("separa linhas completas e devolve o resto (incompleto) separado", () => {
    const { events, rest } = splitNdjsonBuffer('{"type":"a"}\n{"type":"b"}\n{"type":"c"');

    expect(events).toEqual([{ type: "a" }, { type: "b" }]);
    expect(rest).toBe('{"type":"c"');
  });

  it("sem quebra de linha nenhuma: tudo fica no resto, sem eventos", () => {
    const { events, rest } = splitNdjsonBuffer('{"type":"a"');

    expect(events).toEqual([]);
    expect(rest).toBe('{"type":"a"');
  });

  it("ignora linhas em branco", () => {
    const { events, rest } = splitNdjsonBuffer('{"type":"a"}\n\n{"type":"b"}\n');

    expect(events).toEqual([{ type: "a" }, { type: "b" }]);
    expect(rest).toBe("");
  });

  it("buffer vazio: sem eventos, sem resto", () => {
    expect(splitNdjsonBuffer("")).toEqual({ events: [], rest: "" });
  });
});
