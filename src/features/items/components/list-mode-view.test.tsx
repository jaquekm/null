// @vitest-environment jsdom
import type { JSONContent } from "@tiptap/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listEntries, listSections, type ListStyle } from "../lib/list-styles";
import { ListModeView } from "./list-mode-view";

const updateItemContent = vi.fn<(id: string, at: string, content: JSONContent) => Promise<{ ok: true; data: { updatedAt: string } }>>(async () => ({
  ok: true,
  data: { updatedAt: "t2" },
}));
vi.mock("../actions", () => ({
  updateItemContent: (id: string, at: string, content: JSONContent) => updateItemContent(id, at, content),
}));

afterEach(() => {
  cleanup();
  updateItemContent.mockClear();
});

function item(text: string, attrs: Record<string, unknown> = {}): JSONContent {
  return { type: "taskItem", attrs: { checked: false, ...attrs }, content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}
const doc = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });
const list = (...items: JSONContent[]): JSONContent => ({ type: "taskList", content: items });

function renderList(style: ListStyle, content: JSONContent) {
  render(<ListModeView itemId="i1" style={style} content={content} updatedAt="t1" onSaved={vi.fn()} onContentChange={vi.fn()} />);
}

async function saved(): Promise<JSONContent> {
  await waitFor(() => expect(updateItemContent).toHaveBeenCalled());
  return updateItemContent.mock.calls[0]![2];
}

describe("ListModeView", () => {
  it("com o fuso, cada item tem o sininho de lembrete (9.4); sem ele, não", () => {
    render(
      <ListModeView itemId="i1" style="checklist" content={doc(list(item("Leite"), item("Pão", { checked: true })))} updatedAt="t1" onSaved={vi.fn()} onContentChange={vi.fn()} timezone="America/Sao_Paulo" />,
    );
    expect(screen.getByRole("button", { name: "Me lembrar de Leite" })).toBeTruthy();
    // Riscado não ganha sininho.
    expect(screen.queryByRole("button", { name: "Me lembrar de Pão" })).toBeNull();
    cleanup();
    renderList("priority", doc(list(item("Leite"))));
    expect(screen.queryByRole("button", { name: /Me lembrar/ })).toBeNull();
  });

  it("Riscar: toque risca o item", async () => {
    renderList("checklist", doc(list(item("Leite"), item("Pão"))));
    fireEvent.click(screen.getByRole("button", { name: "Pão" }));
    expect(listEntries(await saved()).map((e) => e.checked)).toEqual([false, true]);
  });

  it("Marcar vários: marca sem desmarcar os outros e conta os marcados", async () => {
    renderList("multi", doc(list(item("Filme A", { checked: true }), item("Filme B"))));
    expect(screen.getByText("1 de 2 marcados")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Filme B" }));
    expect(listEntries(await saved()).map((e) => e.checked)).toEqual([true, true]);
  });

  it("Escolher um: a nova escolha substitui a anterior", async () => {
    renderList("single", doc(list(item("Japonês", { checked: true }), item("Pizza"))));
    expect(screen.getByText("Japonês", { selector: "strong" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Pizza" }));
    expect(listEntries(await saved()).map((e) => e.checked)).toEqual([false, true]);
  });

  it("Dar nota: estrela grava a nota e a lista vem da maior para a menor", async () => {
    renderList("rating", doc(list(item("Praia"), item("Serra", { score: 4 }))));
    const rows = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(rows).toEqual(["Nota de Serra", "Nota de Praia"]);
    fireEvent.click(screen.getAllByRole("button", { name: "5 estrelas" })[1]!);
    expect(listEntries(await saved()).map((e) => e.score)).toEqual([5, 4]);
  });

  it("Ordenar e agrupar: numera, sobe item e cria grupo", async () => {
    const heading = (text: string): JSONContent => ({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] });
    renderList("priority", doc(heading("Saúde"), list(item("Dormir"), item("Treinar"))));
    expect(screen.getByText("Saúde")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Subir Dormir" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Subir Treinar" }));
    expect(listSections(await saved())[0]?.entries.map((e) => e.text)).toEqual(["Treinar", "Dormir"]);

    updateItemContent.mockClear();
    const group = screen.getByPlaceholderText(/Novo grupo/);
    fireEvent.change(group, { target: { value: "Família" } });
    fireEvent.keyDown(group, { key: "Enter" });
    expect(listSections(await saved()).map((s) => s.title)).toEqual(["Saúde", "Família"]);
  });
});
