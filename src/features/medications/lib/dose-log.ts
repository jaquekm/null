export interface MedicationDoseUsage {
  medicationId: string;
  name: string;
  expectedDoses: number;
  takenDoses: number;
  missedDoses: number;
}

/**
 * "Remédios esquecidos" (10.16): horários × dias é quanto se esperava tomar
 * no período; comparado com as doses de verdade registradas (`medication_dose_logs`,
 * desde o "Tomei" da 10.5). Remédio sem horário fixo não entra — sem
 * horário não dá pra calcular "esperado".
 */
export function missedDosesForWeek(
  medications: { id: string; name: string; horarios: string[] }[],
  takenCountByMedicationId: Map<string, number>,
  days: number,
): MedicationDoseUsage[] {
  return medications
    .filter((medication) => medication.horarios.length > 0)
    .map((medication) => {
      const expectedDoses = medication.horarios.length * days;
      const takenDoses = takenCountByMedicationId.get(medication.id) ?? 0;
      return { medicationId: medication.id, name: medication.name, expectedDoses, takenDoses, missedDoses: Math.max(0, expectedDoses - takenDoses) };
    });
}
