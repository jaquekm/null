import { z } from "zod";

export const registerFastingManuallySchema = z
  .object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
  })
  .refine((data) => new Date(data.startedAt).getTime() < new Date(data.endedAt).getTime(), {
    message: "O fim precisa ser depois do início.",
    path: ["endedAt"],
  });
