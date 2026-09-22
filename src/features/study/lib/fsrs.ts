import { type Card, type CardInput, type Grade, Rating, State, fsrs, generatorParameters } from "ts-fsrs";

/**
 * `enable_short_term: false` (5.7): sem os passos de (re)aprendizagem em
 * minutos do FSRS — todo card, desde a primeira avaliação, já usa o
 * algoritmo de estabilidade/dificuldade com intervalos em dias. Decisão
 * deliberada: a página de revisão é um lote diário (não uma sessão de
 * "revisar de novo em 1 minuto"), então `state` de um `review_cards` nunca
 * chega a `learning`/`relearning` na prática — só `new` e `review` — e
 * `learning_steps` do FSRS é sempre `0` (não existe coluna pra ele).
 */
export const scheduler = fsrs(generatorParameters({ enable_short_term: false }));

export const REVIEW_STATE_TO_DB: Record<State, string> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

const DB_TO_STATE: Record<string, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

export const GRADES: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

export const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Again]: "Errei",
  [Rating.Hard]: "Difícil",
  [Rating.Good]: "Bom",
  [Rating.Easy]: "Fácil",
};

/** Formato de `review_cards` relevante pro FSRS — um subconjunto da linha da tabela. */
export interface ReviewCardFsrsRow {
  state: string;
  due_at: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review_at: string | null;
}

export function toCardInput(row: ReviewCardFsrsRow): CardInput {
  return {
    state: DB_TO_STATE[row.state] ?? State.New,
    due: row.due_at,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: 0,
    reps: row.reps,
    lapses: row.lapses,
    last_review: row.last_review_at,
  };
}

/** Patch pronto pra `update` em `review_cards` a partir do `Card` que o FSRS devolveu. */
export function cardToRowUpdate(card: Card) {
  return {
    state: REVIEW_STATE_TO_DB[card.state],
    due_at: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    last_review_at: (card.last_review ?? new Date()).toISOString(),
  };
}

export interface GradePreview {
  grade: Grade;
  label: string;
  dueAt: string;
}

/** Prévia dos 4 botões (Errei/Difícil/Bom/Fácil) sem gravar nada — usada pra mostrar o próximo intervalo em cada um. */
export function previewGrades(row: ReviewCardFsrsRow, now: Date): GradePreview[] {
  const preview = scheduler.repeat(toCardInput(row), now);
  return GRADES.map((grade) => ({ grade, label: GRADE_LABELS[grade], dueAt: preview[grade].card.due.toISOString() }));
}

export interface AppliedGrade {
  cardPatch: ReturnType<typeof cardToRowUpdate>;
  log: {
    rating: number;
    stateBefore: string;
    dueBefore: string | null;
    stabilityAfter: number;
    difficultyAfter: number;
  };
}

/** Aplica uma avaliação (1-4) ao card e devolve tanto o patch do card quanto os dados do `review_logs`. */
export function applyGrade(row: ReviewCardFsrsRow, grade: Grade, now: Date): AppliedGrade {
  const { card, log } = scheduler.next(toCardInput(row), now, grade);
  return {
    cardPatch: cardToRowUpdate(card),
    log: {
      rating: log.rating,
      stateBefore: REVIEW_STATE_TO_DB[log.state],
      dueBefore: log.due ? log.due.toISOString() : null,
      stabilityAfter: card.stability,
      difficultyAfter: card.difficulty,
    },
  };
}
