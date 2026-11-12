// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SidebarSpace } from "../queries";
import { SpaceSidebarList } from "./space-sidebar-list";

const moveItem = vi.fn<(id: string, spaceId: string | null) => Promise<{ ok: boolean; error?: string; data?: null }>>(async () => ({ ok: true, data: null }));
const refresh = vi.fn();
vi.mock("@/features/items/actions", () => ({ moveItem: (id: string, spaceId: string | null) => moveItem(id, spaceId) }));
vi.mock("../actions", () => ({ reorderSpace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/espacos/livros", useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ID = "4f1c2d3e-0000-4000-8000-00000000000b";
const spaces = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Trabalho", slug: "trabalho", icon: null, color: null, position: "a" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Pessoal", slug: "pessoal", icon: null, color: null, position: "b" },
] as unknown as SidebarSpace[];

function itemTransfer() {
  const data = new Map<string, string>([["application/x-jkode-item", JSON.stringify({ id: ID, title: "Reunião" })]]);
  return { types: [...data.keys()], getData: (t: string) => data.get(t) ?? "", dropEffect: "" };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SpaceSidebarList — soltar um item num espaço", () => {
  it("item solto num espaço da barra lateral é movido pra ele", async () => {
    render(<SpaceSidebarList spaces={spaces} collapsed={false} />);
    const target = screen.getByText("Pessoal").closest("li")!;
    fireEvent.dragOver(target, { dataTransfer: itemTransfer() });
    fireEvent.drop(target, { dataTransfer: itemTransfer() });
    await waitFor(() => expect(moveItem).toHaveBeenCalledWith(ID, spaces[1]!.id));
    expect(refresh).toHaveBeenCalled();
  });

  it("link, arquivo ou texto arrastados de fora não movem nada", () => {
    render(<SpaceSidebarList spaces={spaces} collapsed={false} />);
    const target = screen.getByText("Pessoal").closest("li")!;
    const outside = { types: ["text/uri-list"], getData: () => "https://exemplo.com", dropEffect: "" };
    fireEvent.drop(target, { dataTransfer: outside });
    expect(moveItem).not.toHaveBeenCalled();
  });
});
