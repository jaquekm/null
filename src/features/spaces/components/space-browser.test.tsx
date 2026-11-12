// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS, type BrowserItem } from "../lib/space-browser";
import type { SidebarSpace } from "../queries";
import { SpaceBrowser } from "./space-browser";

const moveItem = vi.fn<(id: string, spaceId: string | null) => Promise<{ ok: boolean; error?: string; data?: null }>>(async () => ({ ok: true, data: null }));
const refresh = vi.fn();
const toastError = vi.fn();
vi.mock("@/features/items/actions", () => ({ moveItem: (id: string, spaceId: string | null) => moveItem(id, spaceId) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }));

const ID_A = "4f1c2d3e-0000-4000-8000-00000000000a";
const ID_B = "4f1c2d3e-0000-4000-8000-00000000000b";
const item = (id: string, title: string): BrowserItem => ({
  id,
  title,
  typeId: null,
  typeName: "Nota",
  typeIcon: null,
  typeSlug: "nota",
  listStyle: null,
  tags: [],
  updatedAt: "2026-10-26T10:00:00Z",
});
const space = (id: string, name: string): SidebarSpace => ({ id, name, slug: name.toLowerCase(), icon: null, color: null, position: "a" }) as unknown as SidebarSpace;

const items = [item(ID_A, "trecho do livro"), item(ID_B, "Reunião — 30/09/2026")];
const spaces = [space("11111111-1111-4111-8111-111111111111", "Trabalho"), space("22222222-2222-4222-8222-222222222222", "Pessoal")];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SpaceBrowser — mover item que foi criado no lugar errado", () => {
  it("o botão 'Mover para…' manda o item pro espaço escolhido e ele some da lista na hora", async () => {
    render(<SpaceBrowser spaceSlug="livros" items={items} initialFilters={EMPTY_FILTERS} otherSpaces={spaces} />);
    expect(screen.getByText("Reunião — 30/09/2026")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Mover “Reunião — 30/09/2026” para outro espaço"), { target: { value: spaces[0]!.id } });

    await waitFor(() => expect(moveItem).toHaveBeenCalledWith(ID_B, spaces[0]!.id));
    await waitFor(() => expect(screen.queryByText("Reunião — 30/09/2026")).toBeNull());
    expect(screen.getByText("trecho do livro")).toBeTruthy(); // os outros ficam
    expect(refresh).toHaveBeenCalled();
  });

  it("erro ao mover: avisa e o item continua na lista", async () => {
    moveItem.mockResolvedValueOnce({ ok: false, error: "Não foi possível mover o item." });
    render(<SpaceBrowser spaceSlug="livros" items={items} initialFilters={EMPTY_FILTERS} otherSpaces={spaces} />);
    fireEvent.change(screen.getByLabelText("Mover “trecho do livro” para outro espaço"), { target: { value: spaces[1]!.id } });
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não foi possível mover o item."));
    expect(screen.getByText("trecho do livro")).toBeTruthy();
  });

  it("as linhas podem ser arrastadas até a barra lateral", () => {
    render(<SpaceBrowser spaceSlug="livros" items={items} initialFilters={EMPTY_FILTERS} otherSpaces={spaces} />);
    const row = screen.getByText("trecho do livro").closest("a")!;
    expect(row.getAttribute("draggable")).toBe("true");
    const data = new Map<string, string>();
    const dataTransfer = { setData: (t: string, v: string) => data.set(t, v), effectAllowed: "" };
    fireEvent.dragStart(row, { dataTransfer });
    expect(JSON.parse(data.get("application/x-jkode-item")!)).toEqual({ id: ID_A, title: "trecho do livro" });
  });

  it("sem outros espaços, não mostra o botão de mover", () => {
    render(<SpaceBrowser spaceSlug="livros" items={items} initialFilters={EMPTY_FILTERS} otherSpaces={[]} />);
    expect(screen.queryByLabelText(/para outro espaço/)).toBeNull();
  });
});
