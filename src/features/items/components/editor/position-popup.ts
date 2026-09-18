/** Posiciona (fixed) o popup de sugestão (menção ou menu `/`) sob o cursor. */
export function positionPopup(element: HTMLElement, clientRect: (() => DOMRect | null) | null | undefined) {
  const rect = clientRect?.();
  if (!rect) return;
  element.style.position = "fixed";
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.bottom + 4}px`;
  element.style.zIndex = "50";
}
