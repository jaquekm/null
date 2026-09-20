import { describe, expect, it } from "vitest";
import { matchAttendeesToContactIds } from "./match-attendees-to-contacts";

describe("matchAttendeesToContactIds", () => {
  const contacts = [
    { id: "c1", email: "Fulano@Example.com" },
    { id: "c2", email: "ciclana@example.com" },
    { id: "c3", email: null },
  ];

  it("casa por e-mail, ignorando maiúscula/minúscula e espaços", () => {
    const ids = matchAttendeesToContactIds([{ email: " fulano@example.com " }], contacts);
    expect(ids).toEqual(["c1"]);
  });

  it("ignora participantes sem contato correspondente", () => {
    const ids = matchAttendeesToContactIds([{ email: "ninguem@example.com" }], contacts);
    expect(ids).toEqual([]);
  });

  it("não duplica quando o mesmo contato aparece mais de uma vez", () => {
    const ids = matchAttendeesToContactIds(
      [{ email: "fulano@example.com" }, { email: "FULANO@EXAMPLE.COM" }],
      contacts,
    );
    expect(ids).toEqual(["c1"]);
  });

  it("devolve [] pra lista de participantes vazia", () => {
    expect(matchAttendeesToContactIds([], contacts)).toEqual([]);
  });

  it("ignora contatos sem e-mail cadastrado", () => {
    const ids = matchAttendeesToContactIds([{ email: "fulano@example.com" }, { email: "ciclana@example.com" }], contacts);
    expect(ids.sort()).toEqual(["c1", "c2"]);
  });
});
