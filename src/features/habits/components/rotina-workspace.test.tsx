// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HabitForWeek } from "../lib/habit-week";
import { RotinaWorkspace } from "./rotina-workspace";

type ToggleResult = { ok: true; data: { logged: boolean } } | { ok: false; error: string };
const toggleHabitLog = vi.fn<(id: string, date: string) => Promise<ToggleResult>>(async () => ({ ok: true, data: { logged: true } }));
const createHabit = vi.fn(async (input: unknown) => ({ ok: true as const, data: { id: String(input) } }));
const setHabitDays = vi.fn(async (id: string, days: unknown) => ({ ok: true as const, data: [id, days] }));
type DeleteResult = { ok: true; data: null } | { ok: false; error: string };
const deleteHabit = vi.fn<(id: string) => Promise<DeleteResult>>(async () => ({ ok: true, data: null }));
vi.mock("../actions", () => ({
  toggleHabitLog: (id: string, date: string) => toggleHabitLog(id, date),
  createHabit: (input: unknown) => createHabit(input),
  setHabitDays: (id: string, days: unknown) => setHabitDays(id, days),
  deleteHabit: (id: string) => deleteHabit(id),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (m: string) => toastError(m) } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Quarta, 30/09/2026.
const TODAY = "2026-09-30";
const water: HabitForWeek = { id: "w", title: "Água", log: { "2026-09-28": true, "2026-09-29": true }, frequency: "FREQ=DAILY", since: "2026-09-01" };
const gym: HabitForWeek = { id: "g", title: "Academia", log: {}, frequency: "FREQ=WEEKLY;BYDAY=MO,WE,FR", since: "2026-09-01" };

function renderRotina(habits = [water, gym]) {
  render(<RotinaWorkspace habits={habits} today={TODAY} weekStart="2026-09-28" />);
}

describe("RotinaWorkspace", () => {
  it("mostra a semana de segunda a domingo, com hoje e o futuro bloqueado", () => {
    renderRotina();
    expect(screen.getByText("Esta semana")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Água, Segunda 28/09, feito" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: "Água, Quinta 01/10" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("link", { name: /Próxima/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Anterior/ }).getAttribute("href")).toBe("/rotina?semana=2026-09-21");
  });

  it("marca na hora e salva; se falhar, desmarca e avisa", async () => {
    renderRotina();
    fireEvent.click(screen.getByRole("button", { name: "Academia, Quarta 30/09" }));
    expect(screen.getByRole("button", { name: "Academia, Quarta 30/09, feito" })).toBeTruthy();
    expect(toggleHabitLog).toHaveBeenCalledWith("g", TODAY);

    toggleHabitLog.mockResolvedValueOnce({ ok: false, error: "Sem conexão." });
    fireEvent.click(screen.getByRole("button", { name: "Água, Quarta 30/09" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Sem conexão."));
    expect(screen.getByRole("button", { name: "Água, Quarta 30/09" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("mostra a sequência de cada hábito e o mapa de consistência", () => {
    renderRotina();
    expect(screen.getByText("🔥 2")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Mapa de consistência/ })).toBeTruthy();
    expect(screen.getByText("🔥 2 dias seguidos")).toBeTruthy();
  });

  it("cria hábito com os dias escolhidos", async () => {
    renderRotina();
    fireEvent.change(screen.getByLabelText("Novo hábito"), { target: { value: "Ler" } });
    const chips = screen.getAllByRole("group", { name: "Dias da semana" });
    fireEvent.click(chips[chips.length - 1]!.querySelector('[aria-label="Sábado"]')!);
    expect(screen.getByText("sáb")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    await waitFor(() => expect(createHabit).toHaveBeenCalledWith({ title: "Ler", days: ["SA"] }));
  });

  it("muda os dias pelo nome do hábito", async () => {
    renderRotina();
    fireEvent.click(screen.getByRole("button", { name: "Academia: mudar os dias (seg, qua, sex)" }));
    expect(screen.getByText('Dias de "Academia"')).toBeTruthy();
    const editor = screen.getAllByRole("group", { name: "Dias da semana" })[0]!;
    fireEvent.click(editor.querySelector('[aria-label="Sexta"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(setHabitDays).toHaveBeenCalledWith("g", ["MO", "WE"]));
  });

  it("exclui o hábito pelo editor de dias, some da grade; cancelado no confirm não faz nada", async () => {
    renderRotina();
    fireEvent.click(screen.getByRole("button", { name: "Academia: mudar os dias (seg, qua, sex)" }));

    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Excluir hábito" }));
    expect(deleteHabit).not.toHaveBeenCalled();
    expect(screen.getByText('Dias de "Academia"')).toBeTruthy();

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Excluir hábito" }));
    await waitFor(() => expect(deleteHabit).toHaveBeenCalledWith("g"));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Academia: mudar os dias/ })).toBeNull());
    expect(screen.getByRole("button", { name: /Água: mudar os dias/ })).toBeTruthy();
  });

  it("sem hábitos, explica e não mostra grade", () => {
    renderRotina([]);
    expect(screen.getByText(/Nenhum hábito ainda/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
