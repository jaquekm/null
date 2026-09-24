import { z } from "zod";

export const HUB_COST_CATEGORIES = ["supabase", "vercel", "domain", "backup_bucket", "other"] as const;
export type HubCostCategory = (typeof HUB_COST_CATEGORIES)[number];

export const HUB_COST_CATEGORY_LABELS: Record<HubCostCategory, string> = {
  supabase: "Supabase",
  vercel: "Vercel",
  domain: "Domínio",
  backup_bucket: "Bucket de backup",
  other: "Outro",
};

export const createSubscriptionSchema = z.object({
  name: z.string().trim().min(1, "Digite um nome.").max(120),
  monthlyCost: z.string().trim().min(1, "Digite o valor mensal."),
  replacedInPhase: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const createHubCostSchema = z.object({
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês."),
  category: z.enum(HUB_COST_CATEGORIES),
  amount: z.string().trim().min(1, "Digite o valor."),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateHubCostInput = z.infer<typeof createHubCostSchema>;
