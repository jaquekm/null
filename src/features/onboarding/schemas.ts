import { z } from "zod";

export const spaceDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(30).optional(),
});

export type SpaceDraft = z.infer<typeof spaceDraftSchema>;

export const onboardingSchema = z.object({
  spaces: z.array(spaceDraftSchema).min(1, "Escolha ao menos um espaço."),
  timezone: z.string().min(1, "Escolha um fuso horário."),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
