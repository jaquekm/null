import { describe, expect, it } from "vitest";
import { parsePrescriptionLine, parseProgramText } from "./parse-program";

// Trechos reais do "Programa de Treino — 4 dias (Upper/Lower).docx" da dona.
const SAMPLE = `
Estrutura da semana
Treino A — Inferiores 1 (quadríceps e joelho) · ~50 min
Objetivo: fortalecer o quadríceps.
A1. Leg press 45° — quadríceps e glúteos
Sem. 1–2: 2×12 (RIR 3–4) → Sem. 3+: 3×10–12 (RIR 2) · Intervalo 90–120 s · Desce 3 s
Por quê: carrega as pernas sem peso na coluna.
A3. Cadeira flexora sentada — posteriores da coxa
Sem. 1–2: 2×12 (RIR 3) → Sem. 3+: 3×10–12 (RIR 1–2) · Intervalo 90 s
A5. Panturrilha sentada — panturrilhas
2×15 (RIR 1–2) · Intervalo 60 s
A6. Dead bug — core
2 × 6–8 por lado, alternando, bem devagar · Intervalo 60 s
Treino C — Inferiores 2 (glúteos, quadril e core) · ~55 min
C3. Cadeira flexora sentada
Igual ao A3. Sem. 1–2: 2×12 → Sem. 3+: 3×10–12 (RIR 1–2).
C6. Prancha lateral com joelhos dobrados — lateral do core
Sem. 1–2: 2 × 10–15 s por lado → Sem. 3+: 3 × 15–20 s por lado · Progrida até 30 s
`;

describe("parsePrescriptionLine", () => {
  it("duas fases com RIR", () => {
    expect(parsePrescriptionLine("Sem. 1–2: 2×12 (RIR 3–4) → Sem. 3+: 3×10–12 (RIR 2) · Intervalo 90 s")).toEqual({
      early: { sets: 2, min: 12, max: 12, rir: "3–4" },
      later: { sets: 3, min: 10, max: 12, rir: "2" },
      seconds: false,
      perSide: false,
    });
  });

  it("fase única vale pras duas; segundos por lado; sem RIR vira —", () => {
    expect(parsePrescriptionLine("2×15 (RIR 1–2) · Intervalo 60 s")!.later).toEqual({ sets: 2, min: 15, max: 15, rir: "1–2" });
    const plank = parsePrescriptionLine("Sem. 1–2: 2 × 10–15 s por lado → Sem. 3+: 3 × 15–20 s por lado")!;
    expect(plank).toMatchObject({ seconds: true, perSide: true, later: { sets: 3, min: 15, max: 20, rir: "—" } });
  });

  it("linha sem prescrição", () => {
    expect(parsePrescriptionLine("Objetivo: fortalecer o quadríceps.")).toBeNull();
  });
});

describe("parseProgramText", () => {
  const { definition, warnings } = parseProgramText(SAMPLE);

  it("monta os treinos com nome e exercícios na ordem do documento", () => {
    expect(warnings).toEqual([]);
    expect(definition.workouts.map((w) => [w.id, w.name])).toEqual([
      ["A", "Inferiores 1 (quadríceps e joelho)"],
      ["C", "Inferiores 2 (glúteos, quadril e core)"],
    ]);
    expect(definition.workouts[0]!.exercises.map((e) => e.name)).toEqual(["Leg press 45°", "Cadeira flexora sentada", "Panturrilha sentada", "Dead bug"]);
  });

  it('"Igual ao A3" reaproveita o mesmo exercício (mesmo id = mesmo histórico)', () => {
    const flexA = definition.workouts[0]!.exercises[1]!;
    const flexC = definition.workouts[1]!.exercises[0]!;
    expect(flexC).toBe(flexA);
    expect(flexC.id).toBe("cadeira_flexora_sentada");
  });

  it("palpites de carga, unidade, sensibilidade e incremento pelo nome", () => {
    const byName = Object.fromEntries(definition.workouts.flatMap((w) => w.exercises).map((e) => [e.name, e]));
    expect(byName["Leg press 45°"]).toMatchObject({ load: true, sensitive: true, increment: "+5–10 kg", unit: "reps" });
    expect(byName["Dead bug"]).toMatchObject({ load: false, unit: "reps/lado" });
    expect(byName["Prancha lateral com joelhos dobrados"]).toMatchObject({ load: false, unit: "s/lado", increment: "+5 s" });
  });

  it("texto sem o formato esperado explica o que procurar", () => {
    const empty = parseProgramText("Só uma anotação qualquer.");
    expect(empty.definition.workouts).toEqual([]);
    expect(empty.warnings[0]).toContain("Treino A");
  });
});
