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
  setHeight: vi.fn(),
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
  return {
    Area: Empty,
    AreaChart: Empty,
    Bar: Empty,
    BarChart: Empty,
    CartesianGrid: Empty,
    LabelList: Empty,
    Line: Empty,
    LineChart: Empty,
    ResponsiveContainer: Empty,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
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
    render(<TreinosWorkspace programs={[]} sessions={[]} weekly={[]} heightCm={null} />);
    expect(screen.getByRole("tab", { name: "Programa" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Importar Word (.docx)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Montar do zero" })).toBeTruthy();
  });

  it("registrar: mostra os exercícios do treino do programa, troca de treino e salva com as séries digitadas", async () => {
    render(<TreinosWorkspace programs={[program]} sessions={[]} weekly={[]} heightCm={null} />);

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
    render(<TreinosWorkspace programs={[program]} sessions={[]} weekly={[]} heightCm={null} />);
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
    render(<TreinosWorkspace programs={[program]} sessions={[session]} weekly={[]} heightCm={null} />);
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    // Cartão fechado: dia da semana, nome do treino do programa e resumo.
    const card = screen.getByRole("button", { name: /Seg, 28\/09/ });
    expect(within(card).getByText("Treino A · Inferiores 1 (quadríceps e joelho)")).toBeTruthy();
    expect(within(card).getByText("1 exercício · 2 séries · 920 kg")).toBeTruthy();
    fireEvent.click(card);
    expect(screen.getByText("Leg press 45°")).toBeTruthy();
    expect(screen.getByText("40 kg")).toBeTruthy();
  });

  it("histórico: editar um treino abre o formulário preenchido e salva a correção no mesmo registro", async () => {
    const session: WorkoutSession = {
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: "2026-09-28T10:00:00Z",
      programId: program.id,
      date: "2026-09-28",
      week: 1,
      workout: "A",
      exercises: { leg_press_45: { name: "Leg press 45°", load: "40", reps: ["12", "11"], rir: 3, pain: 0, note: "", skipped: false } },
      sleepHours: 7,
      energy: 4,
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
      notes: "ok",
    };
    render(<TreinosWorkspace programs={[program]} sessions={[session]} weekly={[]} heightCm={null} />);
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    fireEvent.click(screen.getByRole("button", { name: /Seg, 28\/09/ }));
    fireEvent.click(screen.getByRole("button", { name: "Editar este treino" }));

    expect(screen.getByText(/Corrigindo o treino de/)).toBeTruthy();
    expect((screen.getByLabelText("Data") as HTMLInputElement).value).toBe("2026-09-28");
    const card = screen.getByText("Leg press 45°").closest("section")!;
    expect((within(card).getByLabelText("Carga (kg)") as HTMLInputElement).value).toBe("40");
    expect((within(card).getByLabelText("Série 2") as HTMLInputElement).value).toBe("11");

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-09-27" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
    await vi.waitFor(() => expect(saveWorkoutSession).toHaveBeenCalledTimes(1));
    expect(saveWorkoutSession.mock.calls[0]![0]).toMatchObject({ sessionId: session.id, date: "2026-09-27", energy: 4, notes: "ok" });
    expect(saveWorkoutSession.mock.calls[0]![0].exercises.leg_press_45).toMatchObject({ load: "40", reps: ["12", "11"] });
    // Corrigir não mexe no rascunho de um treino novo.
    expect(window.localStorage.getItem("treinos:rascunho")).toBeNull();
  });

  it("histórico: dia só de cardio aparece como cardio, com a observação", () => {
    const cardio: WorkoutSession = {
      id: "s2",
      createdAt: "2026-09-29T10:00:00Z",
      programId: program.id,
      date: "2026-09-29",
      week: 1,
      workout: "A",
      exercises: { leg_press_45: { name: "Leg press 45°", load: "", reps: [], rir: null, pain: 0, note: "", skipped: true } },
      sleepHours: 7,
      energy: 3,
      kneePainBefore: 0,
      backPainBefore: 0,
      swelling: false,
      sick: false,
      trafficLight: "green",
      durationMin: 30,
      kneePainAfter: 2,
      backPainAfter: 0,
      kneePainMorning: null,
      backPainMorning: null,
      notes: "bicicleta e esteira 30 min cada",
    };
    render(<TreinosWorkspace programs={[program]} sessions={[cardio]} weekly={[]} heightCm={null} />);
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    const card = screen.getByRole("button", { name: /Ter, 29\/09/ });
    expect(within(card).getByText("Cardio / descanso ativo")).toBeTruthy();
    expect(within(card).getByText("30 min")).toBeTruthy();
    expect(within(card).getByText("“bicicleta e esteira 30 min cada”")).toBeTruthy();
  });

  it("montar do zero: edita treino e exercício e salva o programa em uso", async () => {
    render(<TreinosWorkspace programs={[]} sessions={[]} weekly={[]} heightCm={null} />);
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
