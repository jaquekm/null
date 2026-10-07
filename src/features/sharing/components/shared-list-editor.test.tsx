// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SharedListEditor, type SharedListEntry } from "./shared-list-editor";

const editSharedList = vi.fn();
vi.mock("../actions-public", () => ({ editSharedList: (...args: unknown[]) => editSharedList(...args) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const entry = (index: number, text: string, extra: Partial<SharedListEntry> = {}): SharedListEntry => ({
  index,
  text,
  checked: false,
  score: null,
  details: "",
  author: null,
  scoreBy: null,
  mine: false,
  ...extra,
});

function renderEditor(style: "rating" | "checklist", entries: SharedListEntry[]) {
  render(<SharedListEditor token="tok" title="Rolês" style={style} entries={entries} viewerName="Pedro" />);
}

beforeEach(() => editSharedList.mockResolvedValue({ ok: true, data: null }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SharedListEditor", () => {
  it("diz com que nome a pessoa está mexendo", () => {
    renderEditor("rating", [entry(0, "Boliche")]);
    expect(screen.getByText("Pedro")).toBeTruthy();
  });

  it("adiciona um item", async () => {
    renderEditor("checklist", []);
    fireEvent.change(screen.getByLabelText("Novo item"), { target: { value: "Kart" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(editSharedList).toHaveBeenCalledWith("tok", { op: "add", text: "Kart" }));
  });

  it("dá nota, mostra de quem é a nota, e tocar na mesma nota apaga", async () => {
    renderEditor("rating", [entry(0, "Boliche", { score: 4, scoreBy: "Ana" })]);
    expect(screen.getByText("nota de Ana")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "5 estrelas" }));
    await waitFor(() => expect(editSharedList).toHaveBeenCalledWith("tok", { op: "rate", index: 0, expectText: "Boliche", score: 5 }));
    // Enquanto a ação anterior termina os botões ficam desabilitados; espera voltarem antes do próximo toque.
    await waitFor(() => expect(screen.getByRole("button", { name: "4 estrelas" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "4 estrelas" }));
    await waitFor(() => expect(editSharedList).toHaveBeenCalledWith("tok", { op: "rate", index: 0, expectText: "Boliche", score: null }));
  });

  it("só dá Editar/Apagar no que a pessoa adicionou; mostra quem adicionou o resto", () => {
    renderEditor("rating", [entry(0, "Da dona"), entry(1, "Do Pedro", { author: "Pedro", mine: true }), entry(2, "Da Ana", { author: "Ana" })]);
    expect(screen.getAllByRole("button", { name: /Editar/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Apagar/ })).toHaveLength(1);
    expect(screen.getByText("por Ana")).toBeTruthy();
  });

  it("edita o próprio item", async () => {
    renderEditor("checklist", [entry(0, "Kart", { author: "Pedro", mine: true })]);
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.change(screen.getByLabelText("Detalhes"), { target: { value: "R$ 90" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(editSharedList).toHaveBeenCalledWith("tok", { op: "edit", index: 0, expectText: "Kart", text: "Kart", details: "R$ 90" }));
  });

  it("apaga o próprio item só depois de confirmar", async () => {
    renderEditor("checklist", [entry(0, "Kart", { author: "Pedro", mine: true })]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: /Apagar/ }));
    expect(editSharedList).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Apagar/ }));
    await waitFor(() => expect(editSharedList).toHaveBeenCalledWith("tok", { op: "remove", index: 0, expectText: "Kart" }));
    confirm.mockRestore();
  });
});
