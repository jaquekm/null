import { z } from "zod";

export const focusModes = ["pomodoro", "livre"] as const;
export type FocusMode = (typeof focusModes)[number];

export const logFocusSessionSchema = z.object({
  itemId: z.string().uuid(),
  mode: z.enum(focusModes).default("livre"),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
});
