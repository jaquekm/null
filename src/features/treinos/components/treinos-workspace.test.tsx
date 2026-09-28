// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseProgramText } from "../lib/parse-program";
import type { WorkoutProgram, WorkoutSession } from "../queries";

const saveWorkoutSession = vi.fn();
const saveWorkoutProgram = vi.fn();
vi.mock("../actions", () => ({
  saveWorkoutSession: (input: unknown) => saveWorkoutSession(input),
  updateMorningPain: vi.fn(),
  deleteWorkoutSession: vi.fn(),
  saveWeeklyMeasure: vi.fn(),
  deleteWeeklyMeasure: vi.fn(),
  previewProgramImport: vi.fn(),
  saveWorkoutProgram: (input: unknown) => saveWorkoutProgram(input),
  activateWorkoutProgram: vi.fn(),
  deleteWorkoutProgram: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// recharts precisa de medidas de layout que o jsdom não tem; os gráficos não são o alvo deste teste.
vi.mock("recharts", () => {
  const Empty = () => null;
  return { CartesianGrid: Empty, Line: Empty, LineChart: Empty, ResponsiveContainer: Empty, Tooltip: Empty, XAxis: Empty, YAxis: Empty };
});

const { TreinosWorkspace } = await import("./treinos-workspace");

// Mesmo formato do Word real da dona (trechos).
const { definition } = parseProgramText(`
Treino A — Inferiores 1 (quadríceps e joelho) · ~50 min
A1. Leg press 45° — quadríceps e glúteos
Sem. 1–2: 2×12 (RIR 3–4) → Sem. 3+: 3×10–12 (RIR 2) · Intervalo 90–120 s
A2. Cadeira extensora (amplitude parcial) — quadríceps
Sem. 1–2: 2×15 (RIR 3–4) → Sem. 3+: 3×12–15 (RIR 1–2)
Treino B — Superiores 1 (costas) · ~55 min
B1. Puxada frontal (pulldown) — dorsais
Sem. 1–2: 2×12 (RIR 3–4) → Sem. 3+: 3×8–12 (RIR 2)
`);
const program: WorkoutProgram = { id: "11111111-1111-4111-8111-111111111111", name: "Upper/Lower", definition, active: true, updatedAt: "" };

beforeEach(() => {
  window.localStorage.clear();
  saveWorkoutSession.mockReset();
  saveWorkoutSession.mockResolvedValue({ ok: true, data: { id: "new" } });
  saveWorkoutProgram.mockReset();
  saveWorkoutProgram.mockResolvedValue({ ok: true, data: { id: "p" } });
});
afterEach(cleanup);

describe("TreinosWorkspace", () => {
  it("sem programa, abre direto na aba Programa com importar Word e montar do zero", () => {
    render(<TreinosWorkspace programs={[]} sessions={[]} weekly={[]} />);
    expect(screen.getByRole("tab", { name: "Programa" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Importar Word (.docx)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Montar do zero" })).toBeTruthy();
  });

  it("registrar: mostra os exercícios do treino do programa, troca de treino e salva com as séries digitadas", async () => {
    render(<TreinosWorkspace programs={[program]} sessions={[]} weekly={[]} />);

    // Semana 1: prescrição da readaptação.
    expect(await screen.findByText("Leg press 45°")).toBeTruthy();
    expect(screen.getByText("2 × 12 reps · RIR 3–4")).toBeTruthy();
    expect(screen.getByText("Inferiores 1 (quadríceps e joelho)")).toBeTruthy();

    // Troca pra B: só a puxada.
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(screen.queryByText("Leg press 45°")).toBeNull();
    expect(screen.getByText("Puxada frontal (pulldown)")).toBeTruthy();

    // Volta pra A e preenche o leg press.
    fireEvent.click(screen.getByRole("radio", { name: "A" }));
    const card = screen.getByText("Leg press 45°").closest("section")!;
    fireEvent.change(within(card).getByLabelText("Carga (kg)"), { target: { value: "40" } });
    fireEvent.change(within(card).getByLabelText("Série 1"), { target: { value: "12" } });
    fireEvent.change(within(card).getByLabelText("Série 2"), { target: { value: "11" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar treino" }));
    await vi.waitFor(() => expect(saveWorkoutSession).toHaveBeenCalledTimes(1));
    const payload = saveWorkoutSession.mock.calls[0]![0];
    expect(payload).toMatchObject({ programId: program.id, workout: "A", week: 1, energy: 3 });
    expect(payload.exercises.leg_press_45).toMatchObject({ load: "40", reps: ["12", "11"] });
  });

  it("semáforo reage ao check-in", async () => {
    render(<TreinosWorkspace programs={[program]} sessions={[]} weekly={[]} />);
    expect(await screen.findByText("Verde")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Doente"));
    expect(screen.getByText("Vermelho")).toBeTruthy();
  });

  it("histórico mostra o treino salvo com o nome guardado do exercício", () => {
    const session: WorkoutSession = {
      id: "s1",
      createdAt: "2026-09-28T10:00:00Z",
      programId: program.id,
      date: "2026-09-28",
      week: 1,
      workout: "A",
      exercises: { leg_press_45: { name: "Leg press 45°", load: "40", reps: ["12", "11"], rir: 3, pain: 0, note: "", skipped: false } },
      sleepHours: 7,
      energy: 3,
      kneePainBefore: 0,
      backPainBefore: 0,
      swelling: false,
      sick: false,
      trafficLight: "green",
      durationMin: 42,
      kneePainAfter: 0,
      backPainAfter: 0,
      kneePainMorning: null,
      backPainMorning: null,
      notes: "",
    };
    render(<TreinosWorkspace programs={[program]} sessions={[session]} weekly={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    fireEvent.click(screen.getByRole("button", { name: /28\/09 · sem\. 1/ }));
    expect(screen.getByText("12/11")).toBeTruthy();
    expect(screen.getAllByText("Leg press 45°").length).toBeGreaterThan(0);
  });

  it("montar do zero: edita treino e exercício e salva o programa em uso", async () => {
    render(<TreinosWorkspace programs={[]} sessions={[]} weekly={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Montar do zero" }));

    fireEvent.change(screen.getByLabelText("Nome do treino A"), { target: { value: "Pernas" } });
    fireEvent.change(screen.getByLabelText("Nome do exercício"), { target: { value: "Agachamento no smith" } });
    fireEvent.change(screen.getByLabelText("Semana 3+: séries"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar treino/ }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar e usar este programa" }));
    await vi.waitFor(() => expect(saveWorkoutProgram).toHaveBeenCalledTimes(1));
    const { definition: saved, activate } = saveWorkoutProgram.mock.calls[0]![0];
    expect(activate).toBe(true);
    expect(saved.workouts.map((w: { id: string }) => w.id)).toEqual(["A", "B"]);
    expect(saved.workouts[0]).toMatchObject({ name: "Pernas", exercises: [{ name: "Agachamento no smith", later: { sets: 4 } }] });
  });
});
