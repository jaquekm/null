// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpiryField } from "./expiry-field";

const setItemExpiry = vi.fn<(id: string, at: string, expiry: string | null) => Promise<{ ok: true; data: { updatedAt: string; alerts: number } }>>(async () => ({
  ok: true,
  data: { updatedAt: "t2", alerts: 3 },
}));
vi.mock("../actions", () => ({ setItemExpiry: (id: string, at: string, expiry: string | null) => setItemExpiry(id, at, expiry) }));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (msg: string) => toastSuccess(msg), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  setItemExpiry.mockClear();
  toastSuccess.mockClear();
});

const TODAY = "2026-09-29";

describe("ExpiryField", () => {
  it("salvar a data agenda os avisos", async () => {
    const onChange = vi.fn();
    render(<ExpiryField itemId="i1" value={null} updatedAt="t1" today={TODAY} suggestion={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Validade"), { target: { value: "2031-03-12" } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("2031-03-12", "t2"));
    expect(setItemExpiry).toHaveBeenCalledWith("i1", "t1", "2031-03-12");
    expect(toastSuccess).toHaveBeenCalledWith("Validade salva — 3 avisos agendados antes de vencer.");
  });

  it("mostra quanto falta e deixa tirar a validade", async () => {
    const onChange = vi.fn();
    render(<ExpiryField itemId="i1" value="2026-10-09" updatedAt="t1" today={TODAY} suggestion={null} onChange={onChange} />);
    expect(screen.getByText("vence em 10 dias")).toBeTruthy();
    expect(screen.getByText("Avisos 30, 7 e 1 dia antes, às 9h.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "tirar validade" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null, "t2"));
    expect(setItemExpiry).toHaveBeenCalledWith("i1", "t1", null);
  });

  it("vencido aparece como vencido", () => {
    render(<ExpiryField itemId="i1" value="2026-09-20" updatedAt="t1" today={TODAY} suggestion={null} onChange={vi.fn()} />);
    expect(screen.getByText("venceu há 9 dias")).toBeTruthy();
  });

  it("sugestão do anexo só entra com o toque da dona", async () => {
    const onChange = vi.fn();
    render(<ExpiryField itemId="i1" value={null} updatedAt="t1" today={TODAY} suggestion="2031-03-12" onChange={onChange} />);
    expect(screen.getByText(/Encontrei/).textContent).toContain("12/03/2031");
    expect(setItemExpiry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Usar essa data" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("2031-03-12", "t2"));
  });

  it("sugestão igual à data salva não aparece", () => {
    render(<ExpiryField itemId="i1" value="2031-03-12" updatedAt="t1" today={TODAY} suggestion="2031-03-12" onChange={vi.fn()} />);
    expect(screen.queryByText(/Encontrei/)).toBeNull();
  });
});
