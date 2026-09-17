import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * true só depois da hidratação no navegador. Usado para evitar divergência
 * de hidratação ao ler algo que o servidor não conhece (tema, localStorage...).
 * Implementado com useSyncExternalStore em vez de useEffect+setState porque
 * o eslint (react-hooks/set-state-in-effect) rejeita setState síncrono em efeito.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
