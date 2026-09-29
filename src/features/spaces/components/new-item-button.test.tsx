// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewItemButton } from "./new-item-button";

vi.mock("@/features/templates/actions", () => ({ createItemFromTemplate: vi.fn(async () => ({ ok: true, data: null })) }));
vi.mock("../actions", () => ({ createItemInSpace: vi.fn(async () => ({ ok: true, data: null })) }));

afterEach(cleanup);

const types = [
  { id: "t-nota", name: "Nota", slug: "nota" },
  { id: "t-lista", name: "Lista", slug: "lista" },
];

describe("NewItemButton", () => {
  it("abre com os modelos disponíveis e só eles", () => {
    render(<NewItemButton spaceId="s1" types={types} typeSlugs={["nota", "lista"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Novo" }));
    expect(screen.getByRole("dialog", { name: "O que você quer criar?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Lista de presentes/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nota/ })).toBeTruthy();
    // Reunião não tem o tipo instalado aqui.
    expect(screen.queryByRole("button", { name: /Reunião/ })).toBeNull();
  });

  it("escolher um modelo mostra nome e subcategoria com sugestões, e dá pra voltar", () => {
    const { container } = render(<NewItemButton spaceId="s1" types={types} typeSlugs={["lista"]} subcategories={["cunhada", "casa"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Novo" }));
    fireEvent.click(screen.getByRole("button", { name: /Lista de presentes/ }));
    expect((screen.getByLabelText("Nome") as HTMLInputElement).placeholder).toBe("Ex.: Presentes pra minha cunhada");
    expect(screen.getByLabelText("Subcategoria (opcional)")).toBeTruthy();
    expect([...container.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"))).toEqual(["cunhada", "casa"]);
    expect((container.querySelector('input[name="templateId"]') as HTMLInputElement).value).toBe("lista-presentes");
    fireEvent.click(screen.getByRole("button", { name: /Outros modelos/ }));
    expect(screen.getByRole("button", { name: /Em branco/ })).toBeTruthy();
  });

  it("Em branco mantém o jeito antigo, com o tipo da página pré-escolhido", () => {
    render(<NewItemButton spaceId="s1" types={types} typeSlugs={["nota"]} defaultTypeId="t-lista" />);
    fireEvent.click(screen.getByRole("button", { name: "Novo" }));
    fireEvent.click(screen.getByRole("button", { name: /Em branco/ }));
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe("t-lista");
  });
});
