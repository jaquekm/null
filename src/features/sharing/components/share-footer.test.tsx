// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareFooter } from "./share-footer";

const createShareLink = vi.fn<(input: unknown) => Promise<{ ok: true; data: { url: string } }>>(async () => ({ ok: true, data: { url: "https://hub/p/abc" } }));
vi.mock("../actions", () => ({
  createShareLink: (input: unknown) => createShareLink(input),
  revokeShareLink: vi.fn(),
}));
vi.mock("@/features/contacts/actions", () => ({ searchContacts: vi.fn(async () => []) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  createShareLink.mockClear();
});

describe("ShareFooter", () => {
  it("cria o link com a permissão escolhida e mostra WhatsApp com a mensagem", async () => {
    render(<ShareFooter itemId="4f1c2d3e-0000-4000-8000-000000000001" title="Prioridades de vida" isList links={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Pode marcar itens" }));
    fireEvent.click(screen.getByRole("button", { name: /^Compartilhar$/ }));

    await waitFor(() => expect(screen.getByDisplayValue("https://hub/p/abc")).toBeTruthy());
    expect(createShareLink).toHaveBeenCalledWith({ resourceId: "4f1c2d3e-0000-4000-8000-000000000001", permission: "check", validity: "90d" });
    const whatsapp = screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href") ?? "";
    expect(decodeURIComponent(whatsapp)).toContain("a lista “Prioridades de vida”");
    expect(decodeURIComponent(whatsapp)).toContain("https://hub/p/abc");
  });

  it("fora de lista não oferece marcar itens", () => {
    render(<ShareFooter itemId="i" title="Nota" isList={false} links={[]} />);
    expect(screen.queryByRole("radio", { name: "Pode marcar itens" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Compartilhar" })).toBeTruthy();
  });
});
