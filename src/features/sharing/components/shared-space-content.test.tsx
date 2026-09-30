// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SharedSpaceContent } from "./shared-space-content";

afterEach(cleanup);

const item = (id: string, title: string, subcategories: string[], typeName = "Lista") => ({ id, title, typeName, typeIcon: null, subcategories, updatedAt: "2026-09-30T10:00:00Z" });
const items = [
  item("a", "Presentes pra cunhada", ["família"]),
  item("b", "Receita da vó", ["família"], "Nota"),
  item("c", "Conserto do portão", ["casa"]),
  item("d", "Mercado", ["casa"]),
  item("e", "Farmácia", ["casa"]),
  item("f", "Viagem de fim de ano", ["família"]),
  item("g", "Ideias de passeio", []),
];

describe("SharedSpaceContent", () => {
  it("lista os itens com link pra abrir dentro do próprio link", () => {
    render(<SharedSpaceContent token="tok" name="Pessoal" icon="🏠" subcategory={null} items={items} />);
    expect(screen.getByRole("heading").textContent).toContain("Pessoal");
    expect(screen.getByRole("link", { name: /Presentes pra cunhada/ }).getAttribute("href")).toBe("/p/tok/i/a");
    expect(screen.getByText("7 itens")).toBeTruthy();
  });

  it("filtra por subcategoria e busca", () => {
    render(<SharedSpaceContent token="tok" name="Pessoal" icon={null} subcategory={null} items={items} />);
    fireEvent.click(screen.getByRole("button", { name: /família/ }));
    expect(screen.getAllByRole("link")).toHaveLength(3);
    fireEvent.change(screen.getByPlaceholderText("Buscar nesta lista…"), { target: { value: "receita" } });
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual([expect.stringContaining("Receita da vó")]);
  });

  it("link de subcategoria: título é a subcategoria, sem filtro de subcategorias", () => {
    render(<SharedSpaceContent token="tok" name="Pessoal" icon={null} subcategory="família" items={items.slice(0, 2)} />);
    expect(screen.getByRole("heading").textContent).toContain("família");
    expect(screen.getByText(/Subcategoria de Pessoal/)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Subcategorias" })).toBeNull();
  });
});
