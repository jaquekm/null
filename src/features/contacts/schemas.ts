import { z } from "zod";

export const RELATIONSHIPS = ["client", "family", "friend", "supplier", "partner", "colleague", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  client: "Cliente",
  family: "Família",
  friend: "Amigo",
  supplier: "Fornecedor",
  partner: "Sócio",
  colleague: "Colega",
  other: "Outro",
};

export const PREFERRED_CHANNELS = ["whatsapp", "email"] as const;
export type PreferredChannel = (typeof PREFERRED_CHANNELS)[number];

/** Origens do consentimento (3.3) — a tela explica cada uma ao dono. */
export const CONSENT_SOURCES = ["verbal", "whatsapp", "formulario", "contrato"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const CONSENT_SOURCE_LABELS: Record<ConsentSource, string> = {
  verbal: "Combinado de boca",
  whatsapp: "Confirmado pelo WhatsApp",
  formulario: "Formulário preenchido",
  contrato: "Previsto em contrato",
};

const addressSchema = z
  .object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  })
  .partial();

export type ContactAddress = z.infer<typeof addressSchema>;

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório."),
  nickname: z.string().trim().optional(),
  relationship: z.enum(RELATIONSHIPS).default("other"),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  phone: z.string().trim().optional(), // texto livre — normalizado pra E.164 na action
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD")
    .optional()
    .or(z.literal("")),
  address: addressSchema.optional(),
  notes: z.string().trim().optional(),
  spaceId: z.string().uuid().nullable().optional(),
  preferredChannel: z.enum(PREFERRED_CHANNELS).default("whatsapp"),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

export const consentInputSchema = z.object({
  contactId: z.string().uuid(),
  whatsappOptIn: z.boolean(),
  emailOptIn: z.boolean(),
  consentSource: z.enum(CONSENT_SOURCES).optional(),
});

export const csvColumnKeys = [
  "name",
  "nickname",
  "company",
  "role",
  "phone",
  "email",
  "birthday",
  "notes",
  "ignore",
] as const;
export type CsvColumnKey = (typeof csvColumnKeys)[number];

export const CSV_COLUMN_LABELS: Record<CsvColumnKey, string> = {
  name: "Nome",
  nickname: "Apelido",
  company: "Empresa",
  role: "Cargo",
  phone: "Telefone",
  email: "E-mail",
  birthday: "Aniversário (AAAA-MM-DD)",
  notes: "Notas",
  ignore: "Ignorar coluna",
};
