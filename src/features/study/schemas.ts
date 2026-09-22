import { z } from "zod";

export const createFlashcardSchema = z.object({
  spaceId: z.string().uuid().nullable(),
  deckItemId: z.string().uuid().nullable(),
  front: z.string().trim().min(1, "Preencha a frente do card."),
  back: z.string().trim().min(1, "Preencha o verso do card."),
});
export type CreateFlashcardFormInput = z.input<typeof createFlashcardSchema>;

export const updateFlashcardSidesSchema = z.object({
  itemId: z.string().uuid(),
  front: z.string().trim().min(1, "Preencha a frente do card."),
  back: z.string().trim().min(1, "Preencha o verso do card."),
});

export const submitReviewSchema = z.object({
  cardId: z.string().uuid(),
  grade: z.number().int().min(1).max(4),
  durationMs: z.number().int().nonnegative().nullable(),
});

export const suspendCardSchema = z.object({
  cardId: z.string().uuid(),
  suspended: z.boolean(),
});

export const importAnkiSchema = z.object({
  spaceId: z.string().uuid().nullable(),
  deckItemId: z.string().uuid().nullable(),
  text: z.string().trim().min(1, "Cole o conteúdo exportado ou escolha um arquivo."),
});

export const generateFlashcardsSchema = z.object({
  sourceItemId: z.string().uuid(),
  maxCards: z.number().int().min(1).max(30).default(15),
});

export const generatedFlashcardSchema = z.object({
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
});
export type GeneratedFlashcard = z.infer<typeof generatedFlashcardSchema>;

/** Resposta esperada da IA (5.7: `[{ front, back }]`) — validada com `callClaudeJson`. */
export const generatedFlashcardsResponseSchema = z.array(generatedFlashcardSchema).max(30);

export const approveGeneratedFlashcardsSchema = z.object({
  spaceId: z.string().uuid().nullable(),
  deckItemId: z.string().uuid().nullable(),
  cards: z.array(generatedFlashcardSchema).min(1),
});

export const studySessionKinds = ["study", "review", "reading", "practice", "class"] as const;

export const logStudySessionSchema = z.object({
  itemId: z.string().uuid().nullable(),
  kind: z.enum(studySessionKinds).default("study"),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  notes: z.string().trim().max(2000).optional(),
});

export const studySettingsSchema = z.object({
  dailyNewCardLimit: z.number().int().min(1).max(500),
  reviewPushHour: z.number().int().min(0).max(23),
});
export type StudySettings = z.infer<typeof studySettingsSchema>;

export const DEFAULT_STUDY_SETTINGS: StudySettings = { dailyNewCardLimit: 20, reviewPushHour: 8 };
