import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
});

const serverSchema = z.object({
  APP_URL: z.string().url(),
  OWNER_EMAIL: z.string().email(),
  CRON_SECRET: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Fase 2 — opcionais até a fase de mídia/transcrição
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  TRANSCRIPTION_PROVIDER: z.string().optional(),
  TRANSCRIPTION_API_KEY: z.string().optional(),
  TRANSCRIPTION_WEBHOOK_SECRET: z.string().optional(),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().optional(),

  // Fase 3 — opcionais até agenda/lembretes/compartilhamento
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  MESSAGING_PROVIDER: z.string().optional(),
  N8N_WHATSAPP_WEBHOOK_URL: z.string().optional(),
  N8N_WEBHOOK_SECRET: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // Fase 5 — opcional até uma automação usar a ação `call_webhook` (5.3); reaproveita N8N_WEBHOOK_SECRET pra assinar
  AUTOMATION_WEBHOOK_URL: z.string().optional(),

  // Fase 6 — opcionais até relatórios/busca semântica
  EMBEDDINGS_PROVIDER: z.string().optional(),
  EMBEDDINGS_API_KEY: z.string().optional(),
  EMBEDDINGS_MODEL: z.string().optional(),
  EMBEDDINGS_DIM: z.coerce.number().optional(),

  // Fase 7 — opcional até operação/monitoramento
  SENTRY_DSN: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
    .join("\n");
}

function parsePublicEnv(): PublicEnv {
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  if (!result.success) {
    throw new Error(
      `Variáveis de ambiente públicas inválidas ou ausentes:\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

function parseServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Variáveis de ambiente do servidor inválidas ou ausentes:\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

/**
 * Lê e valida sob demanda, na primeira leitura de uma propriedade — não no
 * import do módulo. Assim, código que importa `env.ts` sem de fato precisar
 * de uma variável (ex.: o proxy, que só valida sessão em rotas protegidas)
 * não quebra por causa de variáveis que só outra rota usa.
 */
function createLazyEnv<T extends object>(parse: () => T): T {
  let cached: T | undefined;
  return new Proxy({} as T, {
    get(_target, prop) {
      cached ??= parse();
      return cached[prop as keyof T];
    },
  });
}

function createServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    return new Proxy({} as ServerEnv, {
      get(_target, prop) {
        throw new Error(
          `serverEnv.${String(prop)} não pode ser acessado no cliente. Use publicEnv para variáveis NEXT_PUBLIC_*.`,
        );
      },
    });
  }
  return createLazyEnv(parseServerEnv);
}

export const publicEnv = createLazyEnv(parsePublicEnv);
export const serverEnv = createServerEnv();
