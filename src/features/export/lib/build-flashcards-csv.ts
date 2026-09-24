/** `frente;verso;baralho`, sem cabeçalho e sem aspas — mesmo formato que `parseAnkiExport` (5.7) já sabe reimportar. */
export interface FlashcardForCsv {
  front: string;
  back: string;
  deckTitle: string;
}

function flatten(value: string): string {
  return value.replace(/\r\n|\r|\n/g, "<br>");
}

export function buildFlashcardsCsv(cards: FlashcardForCsv[]): string {
  const lines = cards.map((c) => [flatten(c.front), flatten(c.back), flatten(c.deckTitle)].join(";"));
  return "﻿" + lines.join("\r\n");
}
