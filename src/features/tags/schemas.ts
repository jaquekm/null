import { z } from "zod";

export const tagInputSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à tag.").max(50),
  color: z.string().trim().max(30).optional(),
});

export type TagInput = z.infer<typeof tagInputSchema>;
