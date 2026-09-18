import { z } from "zod";

export const viewKinds = ["list", "table", "kanban", "calendar", "gallery", "timeline"] as const;
export type ViewKind = (typeof viewKinds)[number];

export const objectTypeInputSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao tipo.").max(80),
  pluralName: z.string().trim().max(80).optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(30).optional(),
  spaceId: z.string().uuid().optional(),
  defaultView: z.enum(viewKinds).default("list"),
  titleTemplate: z.string().trim().max(200).optional(),
});

export type ObjectTypeInput = z.infer<typeof objectTypeInputSchema>;
