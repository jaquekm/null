import { z } from "zod";

export const horarioSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:mm).");

const horariosSchema = z.array(horarioSchema).max(12, "No máximo 12 horários.");
const stockSchema = z.number().int("Estoque deve ser um número inteiro.").min(0, "Estoque não pode ser negativo.").nullable();

export const createMedicationSchema = z.object({
  title: z.string().trim().min(1, "Dê um nome ao remédio.").max(120),
  dose: z.string().trim().max(80).optional(),
  horarios: horariosSchema.default([]),
  stock: stockSchema.default(null),
});

export const setMedicationScheduleSchema = z.object({ horarios: horariosSchema });
export const setMedicationStockSchema = z.object({ stock: stockSchema });
