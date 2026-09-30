// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareSpaceButton, spaceShareMessage } from "./share-space-button";

const createShareLink = vi.fn<(input: unknown) => Promise<{ ok: true; data: { url: string } }>>(async () => ({ ok: true, data: { url: "https://null.prescrittomed.com.br/p/abc" } }));
vi.mock("../actions", () => ({ createShareLink: (input: unknown) => createShareLink(input) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,xyz") } }));

afterEach(() => {
  cleanup();
  createShareLink.mockClear();
});

const subs = [
  { id: "11111111-1111-4111-8111-111111111111", name: "família" },
  { id: "22222222-2222-4222-8222-222222222222", name: "casa" },
];

describe("ShareSpaceButton", () => {
  it("compartilha só a subcategoria do filtro atual, só leitura, e oferece QR", async () => {
    render(<ShareSpaceButton spaceId="33333333-3333-4333-8333-333333333333" spaceName="Pessoal" subcategories={subs} initialTagId={subs[0]!.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    expect((screen.getByLabelText("O que compartilhar") as HTMLSelectElement).value).toBe(subs[0]!.id);

    fireEvent.click(screen.getByRole("button", { name: "Criar link" }));
    await waitFor(() => expect(screen.getByDisplayValue("https://null.prescrittomed.com.br/p/abc")).toBeTruthy());
    expect(createShareLink).toHaveBeenCalledWith({
      resourceType: "space",
      resourceId: "33333333-3333-4333-8333-333333333333",
      tagId: subs[0]!.id,
      permission: "view",
      validity: "90d",
      password: "",
    });
    expect(screen.getByText(/só “família”/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "QR code" }));
    await waitFor(() => expect(screen.getByAltText("QR code do link")).toBeTruthy());
    expect(screen.getByRole("link", { name: /Baixar QR code/ }).getAttribute("download")).toBe("qr-família.png");
  });

  it("espaço inteiro quando não escolhe subcategoria", async () => {
    render(<ShareSpaceButton spaceId="33333333-3333-4333-8333-333333333333" spaceName="Pessoal" subcategories={subs} />);
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar link" }));
    await waitFor(() => expect(createShareLink).toHaveBeenCalled());
    expect((createShareLink.mock.calls[0]![0] as { tagId?: string }).tagId).toBeUndefined();
  });
});

describe("spaceShareMessage", () => {
  it("diz o que está sendo compartilhado", () => {
    expect(spaceShareMessage("Pessoal", "família", "U")).toContain("“família” (Pessoal)");
    expect(spaceShareMessage("Pessoal", null, "U")).toContain("“Pessoal”");
  });
});
