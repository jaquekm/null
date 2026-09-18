import { z } from "zod";

export const spaceInputSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao espaço.").max(80),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(30).optional(),
  description: z.string().trim().max(500).optional(),
});

export type SpaceInput = z.infer<typeof spaceInputSchema>;
