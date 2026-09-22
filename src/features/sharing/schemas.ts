import { z } from "zod";

export const SHARE_PERMISSIONS = ["view", "comment", "check", "settle"] as const;
export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

export const SHARE_PERMISSION_LABELS: Record<SharePermission, string> = {
  view: "Ver",
  comment: "Ver e comentar",
  check: "Marcar itens de checklist",
  settle: 'Ver e marcar "Já paguei"',
};

/** `list`/`report` (enunciado do banco) ainda não têm página pública própria — só `item`, `split` e `bill` (4.10). */
export const SHARE_RESOURCE_TYPES = ["item", "split", "bill"] as const;
export type ShareResourceType = (typeof SHARE_RESOURCE_TYPES)[number];

export const SHARE_VALIDITY_OPTIONS = ["1d", "7d", "30d", "90d", "none"] as const;
export type ShareValidityOption = (typeof SHARE_VALIDITY_OPTIONS)[number];

export const SHARE_VALIDITY_LABELS: Record<ShareValidityOption, string> = {
  "1d": "1 dia",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  none: "Sem validade",
};

export const createShareLinkSchema = z
  .object({
    resourceType: z.enum(SHARE_RESOURCE_TYPES).default("item"),
    resourceId: z.string().uuid(),
    permission: z.enum(SHARE_PERMISSIONS).default("view"),
    validity: z.enum(SHARE_VALIDITY_OPTIONS).default("30d"),
    includeAttachments: z.boolean().default(false),
    /** Só faz sentido pra `resourceType: "split"` — revela a divisão inteira, não só a parte do participante do link. */
    showFullSplit: z.boolean().default(false),
    password: z
      .string()
      .trim()
      .min(4, "A senha precisa ter pelo menos 4 caracteres.")
      .optional()
      .or(z.literal("")),
    contactId: z.string().uuid().optional(),
    label: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.permission === "check" && data.resourceType !== "item") {
      ctx.addIssue({ code: "custom", path: ["permission"], message: "Marcar checklist só vale pra item." });
    }
    if (data.permission === "settle" && data.resourceType === "item") {
      ctx.addIssue({ code: "custom", path: ["permission"], message: '"Já paguei" só vale pra conta ou divisão.' });
    }
  });

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;

export const sharePasswordFormSchema = z.object({
  password: z.string().min(1, "Digite a senha."),
});

export const shareCommentSchema = z.object({
  authorName: z.string().trim().min(1, "Digite seu nome.").max(120),
  body: z.string().trim().min(1, "Escreva uma mensagem.").max(5000),
});
