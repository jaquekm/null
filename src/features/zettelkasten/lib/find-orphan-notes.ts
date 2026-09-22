export interface NoteForOrphanCheck {
  id: string;
  /** Ids que este item aponta (campos `sources`/`source`, genéricos — sem `relationTypeId` fixo). */
  outgoingIds: string[];
}

/**
 * "Notas sem links" (5.11, Zettelkasten — "pra conectar"): uma nota é órfã
 * quando não aponta pra nenhuma outra nota do conjunto **e** nenhuma outra
 * nota do conjunto aponta pra ela. Pura — só considera as relações entre as
 * notas passadas, não o `links` table (que é pra menções `@`, não pra
 * `sources`/`source`, guardados como array de ids em `properties`).
 */
export function findOrphanNoteIds(notes: NoteForOrphanCheck[]): string[] {
  const referenced = new Set<string>();
  for (const note of notes) {
    for (const id of note.outgoingIds) referenced.add(id);
  }
  return notes.filter((note) => note.outgoingIds.length === 0 && !referenced.has(note.id)).map((note) => note.id);
}
