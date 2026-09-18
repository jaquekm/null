/** Diferença entre os ids de link atuais e os novos, para sincronizar `links`. */
export function diffLinks(current: string[], next: string[]): { add: string[]; remove: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);

  return {
    add: next.filter((id) => !currentSet.has(id)),
    remove: current.filter((id) => !nextSet.has(id)),
  };
}
