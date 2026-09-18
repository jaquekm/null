/** "Primeira linha vira título; restante vira corpo" (1.10). */
export function splitTitleAndBody(raw: string): { title: string; body: string } {
  const trimmed = raw.replace(/^\n+/, "");
  const newlineIndex = trimmed.indexOf("\n");
  if (newlineIndex === -1) return { title: trimmed.trim(), body: "" };
  return { title: trimmed.slice(0, newlineIndex).trim(), body: trimmed.slice(newlineIndex + 1) };
}
