// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoutineBlock } from "../lib/routine-blocks";
import { RoutineSchedule } from "./routine-schedule";

type SaveResult = { ok: true; data: RoutineBlock[] } | { ok: false; error: string };
const saveRoutineBlock = vi.fn<(input: unknown) => Promise<SaveResult>>();
const deleteRoutineBlock = vi.fn<(id: unknown) => Promise<SaveResult>>();
vi.mock("../actions", () => ({
  saveRoutineBlock: (input: unknown) => saveRoutineBlock(input),
  deleteRoutineBlock: (id: unknown) => deleteRoutineBlock(id),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TODAY = "2026-09-30"; // quarta
const acordar: RoutineBlock = { id: "a", title: "Acordar", start: "06:00", end: null, days: [] };
const academia: RoutineBlock = { id: "b", title: "Academia", start: "08:00", end: "09:00", days: ["MO", "WE", "FR"] };

describe("RoutineSchedule", () => {
  it("mostra cada dia com seus blocos, hoje marcado", () => {
    render(<RoutineSchedule blocks={[acordar, academia]} today={TODAY} />);
    const quarta = screen.getByRole("region", { name: "Quarta" });
    expect(within(quarta).getByText(/hoje/)).toBeTruthy();
    expect(within(quarta).getByRole("button", { name: "8h–9h Academia (editar)" })).toBeTruthy();
    const terca = screen.getByRole("region", { name: "Terça" });
    expect(within(terca).queryByText("Academia")).toBeNull();
    expect(within(terca).getByRole("button", { name: "6h Acordar (editar)" })).toBeTruthy();
  });

  it("ordena pelo horário mesmo se vier fora de ordem", () => {
    render(<RoutineSchedule blocks={[academia, acordar]} today={TODAY} />);
    const names = within(screen.getByRole("region", { name: "Segunda" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["6h Acordar (editar)", "8h–9h Academia (editar)"]);
  });

  it("sem blocos, explica", () => {
    render(<RoutineSchedule blocks={[]} today={TODAY} />);
    expect(screen.getByText(/Nenhum horário ainda/)).toBeTruthy();
  });

  it("cria um bloco e mostra o que o servidor devolveu", async () => {
    const almoco: RoutineBlock = { id: "c", title: "Almoço", start: "13:00", end: "14:00", days: ["MO"] };
    saveRoutineBlock.mockResolvedValueOnce({ ok: true, data: [acordar, almoco] });
    render(<RoutineSchedule blocks={[acordar]} today={TODAY} />);
    fireEvent.click(screen.getByRole("button", { name: /Bloco/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Almoço" } });
    fireEvent.change(screen.getByLabelText("Começa"), { target: { value: "13:00" } });
    fireEvent.change(screen.getByLabelText("Termina (opcional)"), { target: { value: "14:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Segunda" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(saveRoutineBlock).toHaveBeenCalledWith({ id: undefined, title: "Almoço", start: "13:00", end: "14:00", days: ["MO"] }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Segunda" })).getByText("Almoço")).toBeTruthy());
  });

  it("edita e apaga; erro do servidor aparece", async () => {
    saveRoutineBlock.mockResolvedValueOnce({ ok: false, error: "O fim precisa ser depois do começo." });
    deleteRoutineBlock.mockResolvedValueOnce({ ok: true, data: [acordar] });
    render(<RoutineSchedule blocks={[acordar, academia]} today={TODAY} />);
    fireEvent.click(within(screen.getByRole("region", { name: "Segunda" })).getByRole("button", { name: /Academia/ }));
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Academia");
    fireEvent.change(screen.getByLabelText("Termina (opcional)"), { target: { value: "07:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("O fim precisa ser depois do começo."));
    expect(saveRoutineBlock.mock.calls[0]![0]).toMatchObject({ id: "b", end: "07:00" });

    fireEvent.click(screen.getByRole("button", { name: "Apagar bloco" }));
    await waitFor(() => expect(deleteRoutineBlock).toHaveBeenCalledWith("b"));
    await waitFor(() => expect(screen.queryByText("Academia")).toBeNull());
  });
});
