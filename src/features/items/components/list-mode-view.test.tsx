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

vi.mock("@/features/reminders/actions", () => ({ createReminderFromPhrase: vi.fn() }));
vi.mock("@/features/contacts/actions", () => ({ searchContacts: vi.fn(async () => []) }));

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

describe("ListModeView — texto fora da lista", () => {
  const withText = doc(
    { type: "paragraph", content: [{ type: "text", text: "Salário PJ de setembro" }] },
    { type: "paragraph", content: [{ type: "text", text: "Cliente A" }] },
  );

  it("mostra o texto escrito em vez de sumir com ele", () => {
    renderList("rating", withText);
    expect(screen.getByText("Salário PJ de setembro")).toBeTruthy();
    expect(screen.getByText("Cliente A")).toBeTruthy();
  });

  it("'Editar texto' leva pro editor; 'Transformar as linhas' vira itens da lista", async () => {
    const onEditText = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ListModeView itemId="i1" style="rating" content={withText} updatedAt="t1" onSaved={vi.fn()} onContentChange={vi.fn()} onEditText={onEditText} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar texto" }));
    expect(onEditText).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Transformar as linhas em itens da lista" }));
    expect(listEntries(await saved()).map((e) => e.text)).toEqual(["Salário PJ de setembro", "Cliente A"]);
  });

  it("sem texto solto, não mostra o quadro", () => {
    renderList("checklist", doc(list(item("Leite"))));
    expect(screen.queryByRole("region", { name: "Texto da lista" })).toBeNull();
  });
});

describe("ListModeView — detalhes de cada item (07/10)", () => {
  it("Dar nota: tocar no nome abre os detalhes; salvar grava dentro do item, sem mexer na nota", async () => {
    renderList("rating", doc(list(item("Pousada Mar", { score: 4 }), item("Hotel Sol"))));
    fireEvent.click(screen.getByRole("button", { name: "Pousada Mar" }));
    const box = screen.getByLabelText(/Detalhes de “Pousada Mar”/);
    fireEvent.change(box, { target: { value: "https://pousada.com\nCentro\nR$ 450 a diária" } });
    expect(screen.getByRole("link", { name: "https://pousada.com" }).getAttribute("href")).toBe("https://pousada.com");
    fireEvent.click(screen.getByRole("button", { name: "Salvar detalhes" }));
    const entry = listEntries(await saved()).find((e) => e.text === "Pousada Mar")!;
    expect(entry).toMatchObject({ score: 4, details: "https://pousada.com\nCentro\nR$ 450 a diária" });
  });

  it("detalhes já salvos aparecem embaixo do item, com o link clicável", () => {
    const withDetails: JSONContent = {
      type: "taskItem",
      attrs: { checked: false },
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Duna" }] },
        { type: "paragraph", content: [{ type: "text", text: "Ver em www.netflix.com" }] },
      ],
    };
    renderList("checklist", doc(list(withDetails)));
    expect(screen.getByRole("button", { name: "Duna" }).textContent).not.toContain("netflix");
    expect(screen.getByRole("link", { name: "www.netflix.com" }).getAttribute("href")).toBe("https://www.netflix.com");
    expect(screen.getByRole("button", { name: "Ver detalhes de Duna" })).toBeTruthy();
  });

  it("todos os tipos têm o botão de detalhes", () => {
    for (const style of ["checklist", "multi", "single", "rating", "priority"] as const) {
      renderList(style, doc(list(item("Opção A"))));
      expect(screen.getByRole("button", { name: "Escrever detalhes de Opção A" })).toBeTruthy();
      cleanup();
    }
  });

  it("o alerta abre fora da linha da lista (a linha que “levanta” fazia a tela tremer)", () => {
    render(
      <ListModeView itemId="i1" style="rating" content={doc(list(item("Pousada Mar")))} updatedAt="t1" onSaved={vi.fn()} onContentChange={vi.fn()} timezone="America/Sao_Paulo" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Me lembrar de Pousada Mar" }));
    const dialog = screen.getByRole("dialog", { name: "Me lembrar" });
    expect(dialog.closest("li")).toBeNull();
  });
});
