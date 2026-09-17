import { describe, expect, it } from "vitest";
import { fail, ok } from "./result";

describe("result", () => {
  it("ok() produz um Result de sucesso com os dados", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });

  it("fail() produz um Result de falha com a mensagem de erro", () => {
    expect(fail("algo deu errado")).toEqual({
      ok: false,
      error: "algo deu errado",
      fieldErrors: undefined,
    });
  });

  it("fail() aceita erros por campo", () => {
    const result = fail("dados inválidos", { email: ["obrigatório"] });
    expect(result).toEqual({
      ok: false,
      error: "dados inválidos",
      fieldErrors: { email: ["obrigatório"] },
    });
  });
});
