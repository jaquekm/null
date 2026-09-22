export interface StageSnapshot {
  stage: string | null;
  /** Fim de vigência deste snapshot — `item_versions.created_at` é o instante da edição que o suplantou (a trigger salva o estado ANTERIOR ao UPDATE, `before update`). */
  until: string;
}

export interface StageSegment {
  stage: string;
  enteredAt: string;
  /** `null` = segmento atual, ainda em curso (é o `stage` vigente hoje). */
  leftAt: string | null;
}

/**
 * Reconstrói a sequência de "quanto tempo cada oportunidade passou em cada
 * etapa" a partir do histórico de versões (5.6, painel `/vendas`: "taxa de
 * conversão por etapa" e "tempo médio por etapa" a partir do histórico de
 * versões de `stage`). `versions` vem de `item_versions` ordenado do mais
 * antigo pro mais novo; `current` é o estado vigente hoje. Snapshots
 * consecutivos com o mesmo `stage` são fundidos num segmento só — a trigger
 * de versão dispara em qualquer mudança de propriedade, não só `stage`,
 * então duas versões seguidas frequentemente têm o mesmo `stage`.
 */
export function buildStageSegments(itemCreatedAt: string, versions: StageSnapshot[], current: { stage: string | null }): StageSegment[] {
  const stages: (string | null)[] = [...versions.map((v) => v.stage), current.stage];
  const boundaries: string[] = [itemCreatedAt, ...versions.map((v) => v.until)];

  const segments: StageSegment[] = [];
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!stage) continue;
    const enteredAt = boundaries[i]!;
    const leftAt = i + 1 < boundaries.length ? boundaries[i + 1]! : null;
    const last = segments[segments.length - 1];
    if (last && last.stage === stage && last.leftAt === enteredAt) {
      last.leftAt = leftAt;
    } else {
      segments.push({ stage, enteredAt, leftAt });
    }
  }
  return segments;
}
